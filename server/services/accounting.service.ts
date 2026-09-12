import { db } from '../database/client'
import { accountingEntries, payments, systemConfigs, users } from '../database/schema'
import { and, eq, gte, inArray, isNull, lte, notInArray, or, sql } from 'drizzle-orm'
import { getNeutralKeys } from '../utils/categorie'
import { inCentesimi, inEuro } from '../utils/arrotondamenti'
import { CAT, CATEGORIE_BOLLO, CATEGORIE_PROVENTI_DIVERSI, EMAILS_PROVENTI_DIVERSI } from '#shared/accounting-categories'
import { conFattura, rimuoviSuffissoFattura } from '#shared/fattura'
import { deletePayment } from './payment.service'
import { getBolliDaVersareTotali } from './bollo.service'
import { deleteTutorPayment, reduceReimbursementOnEntryDelete } from './tutor.service'

// ─────────────────────────────────────────────
// REGOLA DEGLI ARROTONDAMENTI (F3) — vale per TUTTO questo file
// Le differenze fra importi si fanno dove i numeri sono esatti (in SQL, oppure in
// centesimi interi) e si arrotonda UNA VOLTA SOLA, alla fine, su ciò che si mostra.
// Mai arrotondare un numero che dovrà ancora essere sommato o sottratto: è così che
// nascevano i centesimi impossibili nelle "Rimanenze di cassa".
// La spiegazione completa, con il perché, sta in server/utils/arrotondamenti.ts.
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// REGOLA FONDAMENTALE — PENNA INDELEBILE
// I movimenti contabili NON si eliminano mai.
// Per correggere un errore si crea uno STORNO (importo negativo).
// reverseTransaction è l'unico modo legale di annullare un movimento.
// ─────────────────────────────────────────────

export async function reverseTransaction(entryId: string, motivo: string) {
  const [original] = await db
    .select()
    .from(accountingEntries)
    .where(eq(accountingEntries.id, entryId))
    .limit(1)

  if (!original) return null

  const importoOriginale = parseFloat(original.importo)
  const importoStorno    = -Math.abs(importoOriginale)  // Sempre negativo

  const [storno] = await db
    .insert(accountingEntries)
    .values({
      tipo:            original.tipo,
      importo:         importoStorno.toFixed(2),
      descrizione:     `STORNO: ${original.descrizione} — ${motivo}`,
      categoria:       original.categoria,
      packageId:       original.packageId,
      lessonId:        original.lessonId,
      // No paymentId: il paymentId è esclusivo del movimento originale (vincolo UNIQUE)
      metodoPagamento: original.metodoPagamento,
      note:            `Storno automatico del movimento ${entryId}`,
    })
    .returning()

  return storno
}

// ─────────────────────────────────────────────
// CASSA VS BANCA — Separazione obbligatoria per rendiconto
// Somma le ENTRATE contabili separate per metodo di pagamento.
// CONTANTI = cassa fisica, BONIFICO = conto bancario
// ─────────────────────────────────────────────

export async function getCashFlow(startDate?: Date, endDate?: Date) {
  const conditions = [eq(accountingEntries.tipo, 'ENTRATA') as any]
  if (startDate) conditions.push(gte(accountingEntries.data, startDate) as any)
  if (endDate)   conditions.push(lte(accountingEntries.data, endDate) as any)

  const rows = await db
    .select({
      metodo: accountingEntries.metodoPagamento,
      totale: sql<string>`COALESCE(SUM(${accountingEntries.importo}::numeric), 0)::text`,
    })
    .from(accountingEntries)
    .where(and(...(conditions as [any, ...any[]])))
    .groupBy(accountingEntries.metodoPagamento)

  // Postgres ha già sommato in modo esatto, un totale per metodo. Qui li rimettiamo
  // insieme in CENTESIMI INTERI: così il totale generale non eredita nessuna coda
  // decimale dai cinque totali parziali, e si arrotonda una volta sola alla fine.
  let totaleContanti = 0
  let totaleBonifico = 0
  let totalePos      = 0
  let totaleAssegno  = 0
  let totaleAltro    = 0

  for (const row of rows) {
    const cent = inCentesimi(row.totale)
    if (row.metodo === 'CONTANTI')      totaleContanti += cent
    else if (row.metodo === 'BONIFICO') totaleBonifico += cent
    else if (row.metodo === 'POS')      totalePos      += cent
    else if (row.metodo === 'ASSEGNO')  totaleAssegno  += cent
    else                                totaleAltro    += cent
  }

  return {
    contanti: inEuro(totaleContanti),
    bonifico: inEuro(totaleBonifico),
    pos:      inEuro(totalePos),
    assegno:  inEuro(totaleAssegno),
    altro:    inEuro(totaleAltro),
    totale:   inEuro(totaleContanti + totaleBonifico + totalePos + totaleAssegno + totaleAltro),
  }
}

// ─────────────────────────────────────────────
// FATTURE IN ATTESA — Tracciamento obbligatorio
// Restituisce tutti i pagamenti dove il cliente ha richiesto fattura
// ma la fattura non è ancora stata emessa.
// Fonte verità: payments.richiedeFattura + accounting_entries.fatturaEmessa
// ─────────────────────────────────────────────

export async function getPendingInvoices() {
  const [daPagamenti, manuali] = await Promise.all([
    db.select({
      paymentId:     payments.id,
      packageId:     payments.packageId,
      importo:       payments.importo,
      tipoPagamento: payments.tipoPagamento,
      dataPagamento: payments.dataPagamento,
      riferimento:   payments.riferimento,
      entryId:       accountingEntries.id,
      metodoPagamento: accountingEntries.metodoPagamento,
      descrizione:   accountingEntries.descrizione,
    })
    .from(payments)
    .innerJoin(accountingEntries, eq(accountingEntries.paymentId, payments.id))
    .where(
      and(
        eq(payments.richiedeFattura, true),
        eq(accountingEntries.fatturaEmessa, false),
      )
    ),
    // Movimenti manuali con "richiede fattura" (es. Proventi diversi, Crediti): niente payment collegato.
    // ENTRATE e CREDITI: le fatture si emettono, non si ricevono.
    db.select().from(accountingEntries).where(
      and(
        inArray(accountingEntries.tipo, ['ENTRATA', 'CREDITO']),
        eq(accountingEntries.richiedeFattura, true),
        eq(accountingEntries.fatturaEmessa, false),
        isNull(accountingEntries.paymentId),
      )
    ),
  ])

  // Le due liste devono avere la STESSA forma, altrimenti chi le legge non può
  // usare i campi presenti solo su una delle due (es. tipoMovimento nella tabella).
  const daPagamentiMapped = daPagamenti.map((p) => ({
    ...p,
    categoria:     null as string | null,
    tipoMovimento: 'PAGAMENTO' as 'ENTRATA' | 'CREDITO' | 'PAGAMENTO',
  }))

  const manualiMapped = manuali.map((e) => ({
    paymentId:     null as string | null,
    packageId:     null as string | null,
    importo:       e.importo,
    tipoPagamento: 'MANUALE',
    dataPagamento: e.data,
    riferimento:   e.descrizione,
    entryId:       e.id,
    metodoPagamento: e.metodoPagamento,
    categoria:     e.categoria, // serve per nascondere le fatture dei proventi ai non autorizzati
    descrizione:   e.descrizione,
    tipoMovimento: e.tipo as 'ENTRATA' | 'CREDITO' | 'PAGAMENTO',
  }))

  return [...daPagamentiMapped, ...manualiMapped]
    .sort((a, b) => new Date(b.dataPagamento).getTime() - new Date(a.dataPagamento).getTime())
}

// ─────────────────────────────────────────────
// FATTURATO — Tutte le fatture segnate come emesse (storico completo):
// quante sono e a quanto ammontano.
// ─────────────────────────────────────────────
export async function getFatturato() {
  const [row] = await db
    .select({
      count:  sql<number>`COUNT(*)::int`,
      totale: sql<string>`COALESCE(SUM(${accountingEntries.importo}::numeric), 0)::text`,
    })
    .from(accountingEntries)
    .where(and(inArray(accountingEntries.tipo, ['ENTRATA', 'CREDITO']), eq(accountingEntries.fatturaEmessa, true)))

  return { count: row?.count ?? 0, totale: Number(parseFloat(row?.totale ?? '0').toFixed(2)) }
}

// ─────────────────────────────────────────────
// PROVENTI DIVERSI — Coppia di movimenti gemelli (+X entrata / -X uscita).
// Margine invariato; entrate, tasse stimate e (se fatturato) il fatturato aumentano.
// Regola di visualizzazione: i numeri principali (entrate/uscite/margine/per metodo/
// saldi/aree) li ESCLUDONO sempre; compaiono solo come riga separata "+X" nelle card
// e SOLO per gli account autorizzati (EMAILS_PROVENTI_DIVERSI).
// ─────────────────────────────────────────────
const CATEGORIE_PROVENTI = CATEGORIE_PROVENTI_DIVERSI

// Solo gli ADMIN con email in lista vedono i proventi diversi (email letta dal DB,
// non dalla sessione: vale anche per sessioni aperte prima di questa modifica)
export async function canSeeProventiDiversi(user: { id: string; role: string }): Promise<boolean> {
  if (user.role !== 'ADMIN') return false
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, user.id)).limit(1)
  return !!u && EMAILS_PROVENTI_DIVERSI.includes(u.email.toLowerCase())
}

// Totali dei proventi diversi nel periodo (per le righe "di cui…" e "+X tasse" delle card)
export async function getProventiDiversiTotali(startDate: Date, endDate: Date) {
  const rows = await db
    .select({
      tipo:   accountingEntries.tipo,
      totale: sql<string>`COALESCE(SUM(${accountingEntries.importo}::numeric), 0)::text`,
    })
    .from(accountingEntries)
    .where(
      and(
        inArray(accountingEntries.tipo, ['ENTRATA', 'USCITA']),
        gte(accountingEntries.data, startDate),
        lte(accountingEntries.data, endDate),
        inArray(accountingEntries.categoria, CATEGORIE_PROVENTI),
      )
    )
    .groupBy(accountingEntries.tipo)

  // Due totali già esatti da SQL: qui si arrotondano una volta sola, e basta —
  // nessuno dei due viene poi risommato a qualcos'altro.
  let entrate = 0
  let uscite  = 0
  for (const r of rows) {
    if (r.tipo === 'ENTRATA') entrate = inCentesimi(r.totale)
    else                      uscite  = inCentesimi(r.totale)
  }
  return { entrate: inEuro(entrate), uscite: inEuro(uscite) }
}

export async function createProventiDiversi(data: {
  importo: number
  descrizione: string
  data?: string
  metodoPagamento?: string | null
  note?: string | null
  richiedeFattura?: boolean
}) {
  return await db.transaction(async (tx) => {
    const base = {
      importo:         data.importo.toFixed(2),
      data:            data.data ? new Date(data.data) : new Date(),
      metodoPagamento: (data.metodoPagamento ?? null) as any,
      note:            data.note ?? null,
    }

    const [entrata] = await tx.insert(accountingEntries).values({
      ...base,
      tipo:            'ENTRATA',
      categoria:       CAT.PROVENTI_DIVERSI,
      descrizione:     data.descrizione,
      richiedeFattura: data.richiedeFattura ?? true,
    }).returning()
    if (!entrata) throw new Error('Creazione movimento entrata fallita')

    const [uscita] = await tx.insert(accountingEntries).values({
      ...base,
      tipo:          'USCITA',
      categoria:     CAT.COSTI_PROVENTI_DIVERSI,
      descrizione:   `Costi — ${data.descrizione}`,
      linkedEntryId: entrata.id,
    }).returning()
    if (!uscita) throw new Error('Creazione movimento uscita fallita')

    await tx.update(accountingEntries)
      .set({ linkedEntryId: uscita.id })
      .where(eq(accountingEntries.id, entrata.id))

    return { ...entrata, linkedEntryId: uscita.id }
  })
}

// ─────────────────────────────────────────────
// MARGINE NETTO — Rendiconto periodico
// Calcola: ENTRATE totali - USCITE totali nel periodo specificato.
// Esclude movimenti di tipo NOTA (informativi, non incidono sul saldo).
// ─────────────────────────────────────────────

// Totali in CENTESIMI INTERI (esatti): è la versione che usa chi deve ancora fare
// dei conti sopra questi numeri — per esempio il break-even e il blocco "doposcuola"
// della dashboard. Arrotondare qui significherebbe sottrarre numeri già approssimati.
type TotaliCent = { entrate: number; uscite: number; margine: number }

async function netMarginCent(startDate: Date, endDate: Date): Promise<TotaliCent> {
  // E3: le categorie "neutre" (giroconti, saldo iniziale…) sono escluse dal margine.
  // L'elenco è configurabile da Impostazioni → Categorie.
  // Anche i proventi diversi restano FUORI dai numeri principali: nelle card
  // compaiono solo come riga separata "+X" (e solo per gli account autorizzati).
  const neutre = await getNeutralKeys()
  const escluse = [...neutre, ...CATEGORIE_PROVENTI]

  const rows = await db
    .select({
      tipo:   accountingEntries.tipo,
      totale: sql<string>`COALESCE(SUM(${accountingEntries.importo}::numeric), 0)::text`,
    })
    .from(accountingEntries)
    .where(
      and(
        inArray(accountingEntries.tipo, ['ENTRATA', 'USCITA']),
        gte(accountingEntries.data, startDate),
        lte(accountingEntries.data, endDate),
        or(isNull(accountingEntries.categoria), notInArray(accountingEntries.categoria, escluse)),
      )
    )
    .groupBy(accountingEntries.tipo)

  let entrate = 0
  let uscite  = 0

  for (const row of rows) {
    if (row.tipo === 'ENTRATA')       entrate = inCentesimi(row.totale)
    else if (row.tipo === 'USCITA')   uscite  = inCentesimi(row.totale)
  }

  return { entrate, uscite, margine: entrate - uscite }
}

export async function getNetMargin(startDate: Date, endDate: Date) {
  const c = await netMarginCent(startDate, endDate)
  return { entrate: inEuro(c.entrate), uscite: inEuro(c.uscite), margine: inEuro(c.margine) }
}

// ─────────────────────────────────────────────
// PREVISIONI — Crediti e Debiti manuali
// ─────────────────────────────────────────────
export async function getPrevisioni(startDate?: Date, endDate?: Date) {
  const conditions = [
    inArray(accountingEntries.tipo, ['CREDITO', 'DEBITO']) as any,
    // Bollo (F1): un bollo già chiuso da un versamento F24 non lo devi più a nessuno.
    // Resta in archivio come storico, ma sparisce dal totale "Da Pagare (Debiti)",
    // altrimenti gli stessi 2 € verrebbero contati due volte: una come debito e una
    // come uscita dell'F24.
    isNull(accountingEntries.versamentoEntryId) as any,
  ]
  if (startDate) conditions.push(gte(accountingEntries.data, startDate) as any)
  if (endDate)   conditions.push(lte(accountingEntries.data, endDate) as any)

  const rows = await db
    .select({
      tipo: accountingEntries.tipo,
      totale: sql<string>`COALESCE(SUM(${accountingEntries.importo}::numeric), 0)::text`,
    })
    .from(accountingEntries)
    .where(and(...(conditions as [any, ...any[]])))
    .groupBy(accountingEntries.tipo)

  let crediti = 0
  let debiti = 0

  for (const row of rows) {
    if (row.tipo === 'CREDITO') crediti = inCentesimi(row.totale)
    else if (row.tipo === 'DEBITO')  debiti = inCentesimi(row.totale)
  }

  return {
    crediti: inEuro(crediti),
    debiti:  inEuro(debiti),
  }
}

// ─────────────────────────────────────────────
// MOVIMENTI PER METODO — Entrate E Uscite separate per ogni metodo, nel periodo.
// Serve alle card "per metodo": ognuna mostra quanto è entrato e quanto è uscito.
// ─────────────────────────────────────────────

type EntrateUscite = { entrate: number; uscite: number; saldo: number }

// Il conto per metodo fatto da Postgres, in CENTESIMI INTERI: entrate, uscite e —
// soprattutto — il SALDO, che qui è una sola sottrazione fatta sugli importi esatti
// del database. Prima il saldo nasceva in JavaScript da due totali già arrotondati:
// è esattamente lì che comparivano i centesimi impossibili delle rimanenze di cassa.
async function movimentiPerMetodoCent(startDate?: Date, endDate?: Date): Promise<Record<string, EntrateUscite>> {
  const conditions = [
    inArray(accountingEntries.tipo, ['ENTRATA', 'USCITA']) as any,
    // I proventi diversi non sono cassa reale: fuori da "per metodo" e saldi cassa
    or(isNull(accountingEntries.categoria), notInArray(accountingEntries.categoria, CATEGORIE_PROVENTI)) as any,
  ]
  if (startDate) conditions.push(gte(accountingEntries.data, startDate) as any)
  if (endDate)   conditions.push(lte(accountingEntries.data, endDate) as any)

  const rows = await db
    .select({
      metodo:  accountingEntries.metodoPagamento,
      entrate: sql<string>`COALESCE(SUM(CASE WHEN ${accountingEntries.tipo} = 'ENTRATA' THEN ${accountingEntries.importo}::numeric ELSE 0 END), 0)::text`,
      uscite:  sql<string>`COALESCE(SUM(CASE WHEN ${accountingEntries.tipo} = 'USCITA'  THEN ${accountingEntries.importo}::numeric ELSE 0 END), 0)::text`,
      // Entrate meno uscite in una sola passata, sui numeri esatti: niente sottrazioni
      // fra valori già arrotondati.
      saldo:   sql<string>`COALESCE(SUM(CASE WHEN ${accountingEntries.tipo} = 'ENTRATA' THEN ${accountingEntries.importo}::numeric ELSE -${accountingEntries.importo}::numeric END), 0)::text`,
    })
    .from(accountingEntries)
    .where(and(...(conditions as [any, ...any[]])))
    .groupBy(accountingEntries.metodoPagamento)

  const vuoto = (): EntrateUscite => ({ entrate: 0, uscite: 0, saldo: 0 })
  const acc: Record<string, EntrateUscite> = {
    CONTANTI: vuoto(), BONIFICO: vuoto(), POS: vuoto(), ASSEGNO: vuoto(), ALTRO: vuoto(),
  }

  // I movimenti senza metodo indicato finiscono in ALTRO, come da sempre: qui si
  // possono sommare più righe sulla stessa voce, e sommare interi è esatto.
  for (const row of rows) {
    const metodo = (row.metodo && acc[row.metodo]) ? row.metodo : 'ALTRO'
    acc[metodo]!.entrate += inCentesimi(row.entrate)
    acc[metodo]!.uscite  += inCentesimi(row.uscite)
    acc[metodo]!.saldo   += inCentesimi(row.saldo)
  }

  const totale = vuoto()
  for (const k of Object.keys(acc)) {
    totale.entrate += acc[k]!.entrate
    totale.uscite  += acc[k]!.uscite
    totale.saldo   += acc[k]!.saldo
  }
  acc.TOTALE = totale

  return acc
}

export async function getMovimentiPerMetodo(startDate?: Date, endDate?: Date) {
  const acc = await movimentiPerMetodoCent(startDate, endDate)

  // Unico arrotondamento della catena: qui, su ciò che la pagina mostra davvero.
  const conv = (e: EntrateUscite): EntrateUscite => ({
    entrate: inEuro(e.entrate),
    uscite:  inEuro(e.uscite),
    saldo:   inEuro(e.saldo),
  })

  return {
    contanti: conv(acc.CONTANTI!),
    bonifico: conv(acc.BONIFICO!),
    pos:      conv(acc.POS!),
    assegno:  conv(acc.ASSEGNO!),
    altro:    conv(acc.ALTRO!),
    totale:   conv(acc.TOTALE!),
  }
}

// ─────────────────────────────────────────────
// SALDI DI CASSA — Rimanenze REALI (sempre dall'inizio attività, non per periodo).
//   contanti = entrate − uscite in CONTANTI (quanto c'è nel cassetto)
//   banca    = entrate − uscite di POS + BONIFICO + ASSEGNO (quanto c'è in banca)
//
// F3: i due saldi arrivano già fatti da Postgres (uno per metodo) e qui si sommano
// come centesimi interi. È il punto che generava i "−0,4 centesimi" segnalati:
// prima si sottraevano fra loro totali già arrotondati, e l'errore restava in fondo.
// ─────────────────────────────────────────────

export async function getSaldiCassa() {
  const acc = await movimentiPerMetodoCent() // tutto lo storico

  const contanti = inEuro(acc.CONTANTI!.saldo)
  const banca    = inEuro(acc.POS!.saldo + acc.BONIFICO!.saldo + acc.ASSEGNO!.saldo)

  return { contanti, banca }
}

// ─────────────────────────────────────────────
// BREAKDOWN MARKETING — Entrate/Uscite categoria 'marketing' vs tutto il resto.
// Il "resto" (doposcuola) è calcolato lato getDashboard: periodo - marketing.
// ─────────────────────────────────────────────

// Versione esatta, in centesimi interi: la dashboard ci sottrae sopra il blocco
// "doposcuola" (periodo − marketing), quindi questi numeri NON vanno arrotondati prima.
async function breakdownMarketingCent(startDate: Date, endDate: Date): Promise<TotaliCent> {
  const [row] = await db
    .select({
      entrate: sql<string>`COALESCE(SUM(CASE WHEN ${accountingEntries.tipo} = 'ENTRATA' THEN ${accountingEntries.importo}::numeric ELSE 0 END), 0)::text`,
      uscite:  sql<string>`COALESCE(SUM(CASE WHEN ${accountingEntries.tipo} = 'USCITA'  THEN ${accountingEntries.importo}::numeric ELSE 0 END), 0)::text`,
      // Anche qui il margine lo fa Postgres, in una passata sola sugli importi esatti.
      margine: sql<string>`COALESCE(SUM(CASE WHEN ${accountingEntries.tipo} = 'ENTRATA' THEN ${accountingEntries.importo}::numeric ELSE -${accountingEntries.importo}::numeric END), 0)::text`,
    })
    .from(accountingEntries)
    .where(
      and(
        inArray(accountingEntries.tipo, ['ENTRATA', 'USCITA']),
        gte(accountingEntries.data, startDate),
        lte(accountingEntries.data, endDate),
        eq(accountingEntries.categoria, CAT.MARKETING),
      )
    )

  return {
    entrate: inCentesimi(row?.entrate),
    uscite:  inCentesimi(row?.uscite),
    margine: inCentesimi(row?.margine),
  }
}

export async function getBreakdownMarketing(startDate: Date, endDate: Date) {
  const c = await breakdownMarketingCent(startDate, endDate)
  return { entrate: inEuro(c.entrate), uscite: inEuro(c.uscite), margine: inEuro(c.margine) }
}

// ─────────────────────────────────────────────
// DASHBOARD — GET /api/accounting/dashboard
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// COSTI FISSI — Spese mensili configurate in Impostazioni
//
// Ogni spesa può avere una validità: `dal` / `al` ('YYYY-MM-DD', entrambi opzionali).
// Una spesa SENZA date vale sempre (è il comportamento storico: i numeri non cambiano
// finché non si compilano le date). Con le date, invece, chiudere una spesa non tocca
// più i mesi già passati: l'affitto pagato fino a giugno resta nei conti fino a giugno.
// ─────────────────────────────────────────────
export type SpesaFissa = { nome: string; importo: number; dal: string | null; al: string | null }

// 'YYYY-MM-DD' → data locale a mezzanotte (nessuno slittamento di fuso)
function giornoDaStringa(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export async function getSpeseFisse(): Promise<SpesaFissa[]> {
  try {
    const [row] = await db
      .select({ value: systemConfigs.value })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, 'spese_fisse'))
      .limit(1)

    if (!row?.value) return []
    const raw = JSON.parse(row.value)
    if (!Array.isArray(raw)) return []

    return raw.map((s: any) => ({
      nome:    String(s?.nome ?? ''),
      importo: Number(s?.importo) || 0,
      dal:     typeof s?.dal === 'string' && s.dal ? s.dal : null,
      al:      typeof s?.al  === 'string' && s.al  ? s.al  : null,
    }))
  } catch {
    return []
  }
}

// Totale MENSILE delle spese attive in un dato giorno (default: oggi).
export async function getCostiFissi(alGiorno?: Date): Promise<number> {
  const spese = await getSpeseFisse()
  return costiFissiMensiliAl(spese, alGiorno ?? new Date())
}

export function costiFissiMensiliAl(spese: SpesaFissa[], giorno: Date): number {
  let totale = 0
  for (const s of spese) {
    const dal = s.dal ? giornoDaStringa(s.dal) : null
    const al  = s.al  ? giornoDaStringa(s.al)  : null
    if (dal && giorno < dal) continue
    if (al  && giorno > al)  continue
    totale += s.importo
  }
  return Number(totale.toFixed(2))
}

// Una riga del conto dei costi fissi, così come la vede l'utente nel popup del break-even.
export type DettaglioCostoFisso = {
  nome: string
  importoMensile: number
  mesi: number
  totalePeriodo: number
}

// Costo fisso di un periodo VOCE PER VOCE: ogni spesa pesa solo per i mesi in cui era
// davvero in vigore (intersezione fra il periodo scelto e la sua validità).
// Le spese fuori periodo non compaiono affatto.
export function dettaglioCostiFissiDelPeriodo(spese: SpesaFissa[], start: Date, end: Date): DettaglioCostoFisso[] {
  const righe: DettaglioCostoFisso[] = []
  for (const s of spese) {
    const dal = s.dal ? giornoDaStringa(s.dal) : null
    const al  = s.al  ? giornoDaStringa(s.al)  : null

    const da = dal && dal > start ? dal : start
    const a  = al  && al  < end   ? al  : end
    if (a < da) continue // spesa fuori dal periodo

    const mesi = mesiCalendario(da, a)
    righe.push({
      nome:           s.nome,
      importoMensile: Number(s.importo.toFixed(2)),
      mesi:           Math.round(mesi * 100) / 100,
      totalePeriodo:  Number((s.importo * mesi).toFixed(2)),
    })
  }
  return righe
}

// Costo fisso TOTALE di un periodo: è la somma ESATTA delle righe di dettaglio (già
// arrotondate ai centesimi), non un secondo conto fatto a parte. Così il numero grande
// e l'elenco che l'utente legge nel popup non possono mai differire di un centesimo.
export function costiFissiDelPeriodo(spese: SpesaFissa[], start: Date, end: Date): number {
  const totale = dettaglioCostiFissiDelPeriodo(spese, start, end)
    .reduce((acc, r) => acc + r.totalePeriodo, 0)
  return Number(totale.toFixed(2))
}

// Mesi di calendario coperti dal periodo, frazioni comprese: un periodo che copre
// esattamente 2 mesi pieni vale 2.0 (non 61 giorni ÷ 30.44 ≈ 2.004, che gonfiava
// i costi fissi di qualche euro). Ogni mese pesa per i giorni civili coperti.
export function mesiCalendario(start: Date, end: Date): number {
  if (end < start) return 0
  let mesi = 0
  let cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const fine = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cur <= fine) {
    const giorniMese = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate()
    const primo  = (cur.getFullYear() === start.getFullYear() && cur.getMonth() === start.getMonth()) ? start.getDate() : 1
    const ultimo = (cur.getFullYear() === end.getFullYear()   && cur.getMonth() === end.getMonth())   ? end.getDate()   : giorniMese
    mesi += (ultimo - primo + 1) / giorniMese
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  return mesi
}

export async function getDashboard(startDate: Date, endDate: Date) {
  // F3: periodo e marketing arrivano in CENTESIMI ESATTI perché qui sotto ci si fanno
  // ancora dei conti sopra (il blocco "doposcuola" e il break-even). Si arrotonda solo
  // alla fine, su ciò che viene restituito all'interfaccia.
  const [periodoCent, perMetodo, saldiCassa, fattureInAttesa, previsioni, marketingCent, speseFisse, fatturato, proventiDiversi, bolliDaVersare] = await Promise.all([
    netMarginCent(startDate, endDate),
    getMovimentiPerMetodo(startDate, endDate),
    getSaldiCassa(),
    getPendingInvoices(),
    getPrevisioni(),
    breakdownMarketingCent(startDate, endDate),
    getSpeseFisse(),
    getFatturato(),
    getProventiDiversiTotali(startDate, endDate),
    getBolliDaVersareTotali(),
  ])

  const periodo = {
    entrate: inEuro(periodoCent.entrate),
    uscite:  inEuro(periodoCent.uscite),
    margine: inEuro(periodoCent.margine),
  }
  const marketing = {
    entrate: inEuro(marketingCent.entrate),
    uscite:  inEuro(marketingCent.uscite),
    margine: inEuro(marketingCent.margine),
  }
  // periodo (netMarginCent) esclude già i proventi diversi → nessuna sottrazione qui
  const doposcuola = {
    entrate: inEuro(periodoCent.entrate - marketingCent.entrate),
    uscite:  inEuro(periodoCent.uscite  - marketingCent.uscite),
    margine: inEuro(periodoCent.margine - marketingCent.margine),
  }

  // Costi fissi: ogni spesa pesa solo per i mesi in cui era in vigore.
  // "mensili" = quanto pesano al mese le spese attive a fine periodo (la foto di quel momento).
  const mesiNelPeriodo      = mesiCalendario(startDate, endDate)
  const costiFissiMensili   = costiFissiMensiliAl(speseFisse, endDate)
  // Il dettaglio è la fonte del totale (vedi costiFissiDelPeriodo): un solo conto,
  // nessuno scarto possibile fra l'elenco nel popup e il numero del break-even.
  const costiFissiDettaglio = dettaglioCostiFissiDelPeriodo(speseFisse, startDate, endDate)
  const costiFissiPeriodo   = costiFissiDelPeriodo(speseFisse, startDate, endDate)
  // Break-even: il margine esatto meno le spese fisse, sottratti in centesimi interi
  // e arrotondati una volta sola. Prima erano due numeri già arrotondati a sottrarsi
  // fra loro, ed è lo stesso difetto delle rimanenze di cassa.
  const breakEven = inEuro(periodoCent.margine - inCentesimi(costiFissiPeriodo))

  return {
    periodo,
    perMetodo,
    saldiCassa,
    previsioni,
    bolliDaVersare,
    fattureInAttesa: { count: fattureInAttesa.length, lista: fattureInAttesa },
    fatturato,
    proventiDiversi,
    breakdown: { doposcuola, marketing },
    costiFissi: {
      mensili: costiFissiMensili,
      periodo: costiFissiPeriodo,
      mesi: Math.round(mesiNelPeriodo * 10) / 10,
      dettaglio: costiFissiDettaglio,
    },
    breakEven,
  }
}

// ─────────────────────────────────────────────
// Un movimento è AUTOMATICO se collegato a una sorgente (pagamento/compenso/rimborso).
// Altrimenti è MANUALE (Credito/Debito/Nota inseriti a mano).
// ─────────────────────────────────────────────
function isAutoEntry(e: { paymentId: string | null; tutorPaymentId: string | null; reimbursementId: string | null }) {
  return !!(e.paymentId || e.tutorPaymentId || e.reimbursementId)
}

// ─────────────────────────────────────────────
// DELETE intelligente di una scrittura contabile.
//   mode = 'storno' → crea un movimento opposto, mantiene lo storico (best practice)
//   mode = 'delete' → eliminazione vera:
//       - se automatica: elimina la SORGENTE (pagamento/compenso/rimborso),
//         che a cascata rimuove anche la scrittura e ricalcola i saldi
//       - se manuale: elimina solo la riga
// ─────────────────────────────────────────────
export async function deleteAccountingEntry(
  entryId: string,
  mode: 'delete' | 'storno',
  motivo = 'Eliminazione manuale',
) {
  const [entry] = await db.select().from(accountingEntries).where(eq(accountingEntries.id, entryId)).limit(1)
  if (!entry) throw new Error('Movimento non trovato')

  // Bollo (F1) già versato con F24: non si tocca più. Toglierlo adesso lascerebbe
  // l'uscita dell'F24 a coprire un bollo che non esiste più, e i conti non tornerebbero.
  await vietaSeBolloGiaVersato(entry)

  if (mode === 'storno') {
    const storno = await reverseTransaction(entryId, motivo)
    // Coppia "Proventi diversi" o "Bollo": lo storno deve riguardare entrambe le gambe,
    // altrimenti il margine si sbilancia
    if (entry.linkedEntryId) await reverseTransaction(entry.linkedEntryId, motivo)
    return storno
  }

  // mode === 'delete'
  if (entry.paymentId) {
    return await deletePayment(entry.paymentId)
  }
  if (entry.tutorPaymentId) {
    return await deleteTutorPayment(entry.tutorPaymentId)
  }
  if (entry.reimbursementId) {
    // Scrittura parziale di rimborso: prima riduci l'importo pagato, poi elimina la riga
    await reduceReimbursementOnEntryDelete(entry.reimbursementId, entry.importo)
    await db.delete(accountingEntries).where(eq(accountingEntries.id, entryId))
    return { ok: true }
  }
  // Movimento manuale (qui rientrano anche le due righe del bollo, che non hanno
  // paymentId): cancellandone una il database porta via anche la gemella, per via
  // del vincolo CASCADE su linkedEntryId. Al pagamento va però restituita la memoria,
  // altrimenti il suo bollo non si potrebbe più registrare.
  await db.delete(accountingEntries).where(eq(accountingEntries.id, entryId))
  await riapriBolloDelPagamento(entry)
  return { ok: true }
}

// ─────────────────────────────────────────────
// BOLLO (F1) — due guardie che valgono per entrambe le righe della coppia.
// ─────────────────────────────────────────────

function isRigaBollo(entry: { categoria: string | null }) {
  return !!entry.categoria && CATEGORIE_BOLLO.includes(entry.categoria)
}

// Un bollo è "già versato" se il suo DEBITO porta il riferimento a un'uscita F24.
// Il controllo vale anche partendo dall'ENTRATA: la gemella è a un passo di distanza.
async function vietaSeBolloGiaVersato(entry: { id: string; categoria: string | null; linkedEntryId: string | null; versamentoEntryId: string | null }) {
  if (!isRigaBollo(entry)) return
  if (entry.versamentoEntryId) {
    throw new Error('Questo bollo è già stato versato con l\'F24: non si può più eliminare.')
  }
  if (entry.linkedEntryId) {
    const [gemella] = await db
      .select({ versamentoEntryId: accountingEntries.versamentoEntryId })
      .from(accountingEntries)
      .where(eq(accountingEntries.id, entry.linkedEntryId))
      .limit(1)
    if (gemella?.versamentoEntryId) {
      throw new Error('Questo bollo è già stato versato con l\'F24: non si può più eliminare.')
    }
  }
}

// Cancellata una riga del bollo, il pagamento torna "senza bollo": così la segreteria
// può registrarlo di nuovo se l'aveva tolto per sbaglio. Il legame col pagamento è
// scritto nelle note (bolloPaymentId:…), perché la colonna paymentId è già occupata.
async function riapriBolloDelPagamento(entry: { categoria: string | null; note: string | null }) {
  if (!isRigaBollo(entry)) return
  const paymentId = entry.note?.match(/bolloPaymentId:([A-Za-z0-9_-]+)/)?.[1]
  if (!paymentId) return
  await db.update(payments)
    .set({ bolloRegistratoAt: null, updatedAt: new Date() })
    .where(eq(payments.id, paymentId))
}

// ─────────────────────────────────────────────
// UPDATE consentito SOLO sui movimenti manuali.
// I movimenti automatici vanno corretti dal pagamento di origine (o eliminati).
// ─────────────────────────────────────────────
export async function updateAccountingEntry(
  entryId: string,
  data: {
    tipo?: string
    importo?: number
    descrizione?: string
    categoria?: string | null
    metodoPagamento?: string | null
    data?: string
    fatturaEmessa?: boolean
    richiedeFattura?: boolean
    numeroFattura?: string
    dataFattura?: string
  },
) {
  const [entry] = await db.select().from(accountingEntries).where(eq(accountingEntries.id, entryId)).limit(1)
  if (!entry) throw new Error('Movimento non trovato')

  const hasContentChange = data.tipo !== undefined || data.importo !== undefined
    || data.descrizione !== undefined || data.categoria !== undefined
    || data.metodoPagamento !== undefined || data.data !== undefined

  if (isAutoEntry(entry) && hasContentChange) {
    throw new Error('Questo movimento è automatico: modificalo dal pagamento di origine (oppure eliminalo).')
  }

  if (entry.linkedEntryId && hasContentChange) {
    // Vale per le coppie gemelle: "Proventi diversi" e bollo. Modificarne una sola
    // gamba sbilancerebbe l'altra, quindi la coppia si elimina e si rifà.
    const etichetta = isRigaBollo(entry) ? 'del bollo' : '"Proventi diversi"'
    throw new Error(`Movimento accoppiato ${etichetta}: per correggerlo elimina la coppia e ricreala.`)
  }

  const changes: Record<string, unknown> = { updatedAt: new Date() }
  if (data.fatturaEmessa !== undefined)   changes.fatturaEmessa   = data.fatturaEmessa
  if (data.richiedeFattura !== undefined) changes.richiedeFattura = data.richiedeFattura
  if (data.tipo !== undefined)            changes.tipo            = data.tipo
  if (data.importo !== undefined)         changes.importo         = String(data.importo)
  if (data.descrizione !== undefined)     changes.descrizione     = data.descrizione
  if (data.categoria !== undefined)       changes.categoria       = data.categoria
  if (data.metodoPagamento !== undefined) changes.metodoPagamento = data.metodoPagamento
  if (data.data !== undefined)            changes.data            = new Date(data.data)

  // Numero+data fattura: si accodano (o si rimuovono) dalla descrizione, non hanno colonna dedicata
  if (data.fatturaEmessa === true && data.numeroFattura) {
    const base = (changes.descrizione as string | undefined) ?? entry.descrizione
    changes.descrizione = conFattura(base, data.numeroFattura, data.dataFattura ?? new Date().toISOString().slice(0, 10))
  } else if (data.fatturaEmessa === false) {
    const base = (changes.descrizione as string | undefined) ?? entry.descrizione
    changes.descrizione = rimuoviSuffissoFattura(base)
  }

  const [updated] = await db.update(accountingEntries).set(changes as any).where(eq(accountingEntries.id, entryId)).returning()
  return updated
}
