import { db } from '../database/client'
import { accountingEntries, payments } from '../database/schema'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { CAT, CATEGORIE_BOLLO } from '#shared/accounting-categories'
import { IMPORTO_BOLLO, serveBollo } from '#shared/bollo'
import { rimuoviSuffissoFattura } from '#shared/fattura'
import { inCentesimi, inEuro } from '../utils/arrotondamenti'

// ─────────────────────────────────────────────
// LA MARCA DA BOLLO (F1)
//
// Sopra i 77,47 € la fattura vuole una marca da bollo da 2 €, che paga il cliente.
// Quei 2 € non entrano nel prezzo del pacchetto: sono una riga a parte.
//
// In contabilità il bollo nasce SEMPRE in coppia, come i "Proventi diversi":
//   ENTRATA 2 €  "Bollo — Luca Rossi · Superiori 2026/2027"            → cassa vera
//   DEBITO  2 €  "Bollo virtuale da versare — Luca Rossi · Superiori…" → dovuto allo Stato
// Le due righe si puntano a vicenda con linkedEntryId: cancellarne una porta via
// anche l'altra (è il vincolo ON DELETE CASCADE del database, non un controllo del
// codice che qualcuno potrebbe dimenticare di richiamare).
//
// Il debito NON tocca la cassa: i movimenti di tipo DEBITO sono già esclusi da
// contanti e banca. Ed è giusto: quei 2 € li hai davvero in cassa finché non li versi.
// ─────────────────────────────────────────────

export type Transazione = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Cosa è successo al bollo dopo un'operazione: lo legge la pagina per scriverlo nel messaggio. */
export type EsitoBollo = 'CREATO' | 'RIMOSSO' | 'GIA_VERSATO' | null

// Il legame fra il bollo e il suo incasso vive nelle note delle due righe (vedi sotto):
// "bolloPaymentId:…" per un pagamento pacchetto, "bolloEntryId:…" per un movimento
// inserito a mano. Il formato si scrive qui una volta sola.
export const notaBolloPagamento = (paymentId: string) => `bolloPaymentId:${paymentId}`
export const notaBolloMovimento = (entryId: string) => `bolloEntryId:${entryId}`

/** Il riferimento che compare in coda alla descrizione: "Luca Rossi · Superiori 2026/2027". */
export function riferimentoBollo(nomeStudente: string, nomePacchetto: string): string {
  return [nomeStudente.trim(), nomePacchetto.trim()].filter(Boolean).join(' · ')
}

/**
 * Crea le due righe gemelle del bollo DENTRO una transazione già aperta (quella del
 * pagamento): o nascono pagamento e bollo insieme, o non nasce niente.
 *
 * Non fa nulla — e non è un errore — se il bollo non serve o se su questo pagamento
 * è già stato registrato: la spunta può arrivare due volte (doppio clic, modulo
 * rimandato), e incassare due volte gli stessi 2 € sarebbe un danno vero.
 *
 * Restituisce l'id dell'ENTRATA creata, oppure null se non c'era niente da fare.
 */
export async function registraBolloInTransazione(
  tx: Transazione,
  dati: {
    paymentId:       string
    packageId:       string
    importoPagato:   number
    richiedeFattura: boolean
    metodoPagamento: string | null
    data:            Date
    riferimento:     string   // "Luca Rossi · Superiori 2026/2027"
  },
): Promise<string | null> {
  if (!serveBollo(dati.importoPagato, dati.richiedeFattura)) return null

  // Il lucchetto vero: aggiorniamo bollo_registrato_at solo se è ancora vuoto.
  // Se due richieste arrivano insieme, una sola delle due si porta a casa la riga —
  // il database garantisce che l'altra non trovi più nulla da aggiornare.
  const segnati = await tx
    .update(payments)
    .set({ bolloRegistratoAt: new Date(), updatedAt: new Date() })
    .where(and(eq(payments.id, dati.paymentId), isNull(payments.bolloRegistratoAt)))
    .returning({ id: payments.id })

  if (segnati.length === 0) return null // bollo già registrato su questo pagamento

  return await inserisciCoppiaBollo(tx, {
    data:            dati.data,
    packageId:       dati.packageId,
    // Il bollo non può usare paymentId (la colonna è UNIQUE ed è già presa dal
    // movimento del pagamento). Il legame col pagamento vive qui, nelle note, come
    // si fa già per i compensi tutor: serve a ritrovare il bollo se il pagamento
    // viene cancellato, e a riaprire la strada se il bollo viene cancellato a mano.
    note:            notaBolloPagamento(dati.paymentId),
    metodoPagamento: dati.metodoPagamento,
    riferimento:     dati.riferimento,
  })
}

// Le due righe gemelle vere e proprie, uguali per pagamenti e movimenti manuali.
// Restituisce l'id dell'ENTRATA.
async function inserisciCoppiaBollo(
  tx: Transazione,
  dati: { data: Date; packageId: string | null; note: string; metodoPagamento: string | null; riferimento: string },
): Promise<string> {
  const base = {
    importo:   IMPORTO_BOLLO.toFixed(2),
    data:      dati.data,
    packageId: dati.packageId,
    note:      dati.note,
  }

  const [entrata] = await tx.insert(accountingEntries).values({
    ...base,
    tipo:            'ENTRATA',
    categoria:       CAT.BOLLO_INCASSATO,
    descrizione:     `Bollo — ${dati.riferimento}`,
    metodoPagamento: (dati.metodoPagamento ?? null) as any,
  }).returning()
  if (!entrata) throw new Error('Creazione della riga del bollo fallita')

  const [debito] = await tx.insert(accountingEntries).values({
    ...base,
    tipo:          'DEBITO',
    categoria:     CAT.BOLLO_DA_VERSARE,
    descrizione:   `Bollo virtuale da versare — ${dati.riferimento}`,
    // Il debito verso lo Stato non ha un metodo di pagamento: lo avrà l'F24.
    linkedEntryId: entrata.id,
  }).returning()
  if (!debito) throw new Error('Creazione del debito del bollo fallita')

  // Il legame va scritto nei due versi, come per i "Proventi diversi": così
  // cancellare l'una o l'altra riga porta via comunque la gemella.
  await tx.update(accountingEntries)
    .set({ linkedEntryId: debito.id })
    .where(eq(accountingEntries.id, entrata.id))

  return entrata.id
}

// ─────────────────────────────────────────────
// IL BOLLO DEI MOVIMENTI INSERITI A MANO
//
// Un'entrata registrata a mano (anche la gamba ENTRATA dei "Proventi diversi", o un
// credito appena incassato) con fattura richiesta e sopra 77,47 € vuole il suo bollo,
// come un pagamento pacchetto. Qui non c'è un pagamento su cui mettere il lucchetto:
// il lucchetto è il movimento stesso, bloccato finché la transazione non finisce.
// ─────────────────────────────────────────────

/** Il bollo serve a questo movimento così com'è adesso? */
export function bolloServeAlMovimento(e: {
  tipo: string; importo: string; richiedeFattura: boolean; categoria: string | null; paymentId: string | null
}): boolean {
  if (e.tipo !== 'ENTRATA') return false           // un credito non ancora incassato non ha il bollo
  if (e.paymentId) return false                    // i pagamenti pacchetto hanno la loro strada
  if (e.categoria && CATEGORIE_BOLLO.includes(e.categoria)) return false // il bollo di un bollo no
  if (e.categoria === CAT.RETTIFICA) return false  // una rettifica dei saldi non è un incasso
  return serveBollo(parseFloat(e.importo), e.richiedeFattura)
}

/**
 * Crea il bollo di un movimento manuale DENTRO la transazione di chi lo chiama.
 * Non fa nulla se il bollo non serve o se c'è già: doppio clic e richieste rimandate
 * non devono mai produrre due bolli sullo stesso incasso.
 */
export async function registraBolloMovimentoInTransazione(tx: Transazione, entryId: string): Promise<EsitoBollo> {
  // FOR UPDATE: se due richieste arrivano insieme, la seconda aspetta qui che la prima
  // abbia finito, e il controllo qui sotto trova già il bollo appena creato.
  const [origine] = await tx.select().from(accountingEntries).where(eq(accountingEntries.id, entryId)).for('update')
  if (!origine || !bolloServeAlMovimento(origine)) return null

  const nota = notaBolloMovimento(entryId)
  const [esistente] = await tx
    .select({ id: accountingEntries.id })
    .from(accountingEntries)
    .where(and(inArray(accountingEntries.categoria, CATEGORIE_BOLLO), eq(accountingEntries.note, nota)))
    .limit(1)
  if (esistente) return null

  // Nel riferimento va la descrizione del movimento, senza il suffisso della fattura
  // e accorciata: il bollo deve restare leggibile nell'elenco "Bolli da versare".
  const descrizione = rimuoviSuffissoFattura(origine.descrizione).trim()
  await inserisciCoppiaBollo(tx, {
    data:            origine.data,
    packageId:       null,
    note:            nota,
    metodoPagamento: origine.metodoPagamento,
    riferimento:     descrizione.length > 80 ? `${descrizione.slice(0, 79)}…` : descrizione,
  })
  return 'CREATO'
}

/**
 * Toglie il bollo di un incasso (le due righe gemelle), se non è ancora stato versato.
 * `note` = i legami da cercare (notaBolloPagamento / notaBolloMovimento).
 * Già versato con l'F24 → non tocca niente e lo dice: decide chi chiama se è un errore.
 */
export async function togliBolloInTransazione(tx: Transazione, note: string[]): Promise<EsitoBollo> {
  // FOR UPDATE: mentre decidiamo, nessuno può includere questi bolli in un F24.
  const righe = await tx
    .select({ id: accountingEntries.id, versamentoEntryId: accountingEntries.versamentoEntryId })
    .from(accountingEntries)
    .where(and(inArray(accountingEntries.categoria, CATEGORIE_BOLLO), inArray(accountingEntries.note, note)))
    .for('update')

  if (righe.some(r => r.versamentoEntryId)) return 'GIA_VERSATO'
  if (righe.length === 0) return null

  // Basta cancellarle: sono gemelle, il vincolo CASCADE porta via anche l'altra
  // se qui ne dovesse restare fuori una.
  await tx.delete(accountingEntries).where(inArray(accountingEntries.id, righe.map(r => r.id)))
  return 'RIMOSSO'
}

// ─────────────────────────────────────────────
// I BOLLI ANCORA APERTI — quelli incassati e non ancora versati con l'F24.
// Un bollo è aperto se è un DEBITO di categoria "bollo da versare" e la casella
// del versamento è ancora vuota.
// ─────────────────────────────────────────────

const condizioneBolloAperto = () => and(
  eq(accountingEntries.tipo, 'DEBITO'),
  eq(accountingEntries.categoria, CAT.BOLLO_DA_VERSARE),
  isNull(accountingEntries.versamentoEntryId),
)

/** Quanti sono e quanto fanno: è il contenuto della card "Bolli da versare". */
export async function getBolliDaVersareTotali() {
  const [row] = await db
    .select({
      count:  sql<number>`COUNT(*)::int`,
      totale: sql<string>`COALESCE(SUM(${accountingEntries.importo}::numeric), 0)::text`,
    })
    .from(accountingEntries)
    .where(condizioneBolloAperto())

  return { count: row?.count ?? 0, totale: inEuro(inCentesimi(row?.totale)) }
}

/** L'elenco vero e proprio, per il dettaglio: chi, quando, quanto. */
export async function getBolliDaVersare() {
  const lista = await db
    .select({
      id:          accountingEntries.id,
      data:        accountingEntries.data,
      descrizione: accountingEntries.descrizione,
      importo:     accountingEntries.importo,
    })
    .from(accountingEntries)
    .where(condizioneBolloAperto())
    .orderBy(desc(accountingEntries.data), desc(accountingEntries.id))

  const totaleCent = lista.reduce((acc, r) => acc + inCentesimi(r.importo), 0)

  return { count: lista.length, totale: inEuro(totaleCent), lista }
}

// ─────────────────────────────────────────────
// IL VERSAMENTO CUMULATIVO CON F24
//
// Il bollo virtuale non si compra dal tabaccaio una marca alla volta: si accumula e
// si versa tutto insieme. Quindi qui non si salda una riga per volta — nasce UNA
// SOLA uscita con il totale, e tutti i bolli inclusi vengono segnati come versati.
// Tutto dentro una transazione: o si chiude tutto, o non si chiude niente.
// ─────────────────────────────────────────────

export async function registraVersamentoF24(dati: {
  data:            Date
  metodoPagamento: string
  note?:           string | null
}) {
  return await db.transaction(async (tx) => {
    // FOR UPDATE: mentre stiamo chiudendo questi bolli, nessun altro può prenderli e
    // versarli una seconda volta. È la rete contro il doppio clic e contro due
    // persone che registrano l'F24 nello stesso momento.
    const aperti = await tx
      .select({ id: accountingEntries.id, importo: accountingEntries.importo })
      .from(accountingEntries)
      .where(condizioneBolloAperto())
      .for('update')

    if (aperti.length === 0) {
      throw new Error('Non ci sono bolli da versare: il conto è già a zero.')
    }

    // Il totale è la somma esatta dei bolli inclusi, in centesimi interi: l'uscita
    // dell'F24 e le righe che chiude devono coincidere al centesimo, sempre.
    const totaleCent = aperti.reduce((acc, r) => acc + inCentesimi(r.importo), 0)

    const [uscita] = await tx.insert(accountingEntries).values({
      tipo:            'USCITA',
      importo:         inEuro(totaleCent).toFixed(2),
      descrizione:     `Versamento bolli F24 — ${aperti.length} ${aperti.length === 1 ? 'bollo' : 'bolli'}`,
      categoria:       CAT.VERSAMENTO_BOLLI,
      metodoPagamento: dati.metodoPagamento as any,
      data:            dati.data,
      note:            dati.note ?? null,
    }).returning()
    if (!uscita) throw new Error('Creazione del movimento di versamento fallita')

    // Un solo UPDATE per tutti: ogni bollo incluso punta all'uscita che lo ha chiuso.
    // Da qui in poi non risulta più "da versare" e sparisce dal totale "Da Pagare".
    await tx.update(accountingEntries)
      .set({ versamentoEntryId: uscita.id, updatedAt: new Date() })
      .where(and(
        eq(accountingEntries.categoria, CAT.BOLLO_DA_VERSARE),
        isNull(accountingEntries.versamentoEntryId),
        inArray(accountingEntries.id, aperti.map(r => r.id)),
      ))

    return { entry: uscita, bolliChiusi: aperti.length, totale: inEuro(totaleCent) }
  })
}
