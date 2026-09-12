import { db } from '../database/client'
import { accountingEntries, payments } from '../database/schema'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { CAT } from '#shared/accounting-categories'
import { IMPORTO_BOLLO, serveBollo } from '#shared/bollo'
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

type Transazione = Parameters<Parameters<typeof db.transaction>[0]>[0]

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

  const base = {
    importo:   IMPORTO_BOLLO.toFixed(2),
    data:      dati.data,
    packageId: dati.packageId,
    // Il bollo non può usare paymentId (la colonna è UNIQUE ed è già presa dal
    // movimento del pagamento). Il legame col pagamento vive qui, nelle note, come
    // si fa già per i compensi tutor: serve a ritrovare il bollo se il pagamento
    // viene cancellato, e a riaprire la strada se il bollo viene cancellato a mano.
    note:      `bolloPaymentId:${dati.paymentId}`,
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
