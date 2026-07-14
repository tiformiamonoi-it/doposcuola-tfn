import { db } from '../database/client'
import { accountingEntries, payments, systemConfigs, users } from '../database/schema'
import { and, eq, gte, inArray, isNull, lte, notInArray, or, sql } from 'drizzle-orm'
import { getNeutralKeys } from '../utils/categorie'
import { CATEGORIE_PROVENTI_DIVERSI, EMAILS_PROVENTI_DIVERSI } from '#shared/accounting-categories'
import { deletePayment } from './payment.service'
import { deleteTutorPayment, reduceReimbursementOnEntryDelete } from './tutor.service'

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

  let totaleContanti = 0
  let totaleBonifico = 0
  let totalePos      = 0
  let totaleAssegno  = 0
  let totaleAltro    = 0

  for (const row of rows) {
    const val = parseFloat(row.totale)
    if (row.metodo === 'CONTANTI')      totaleContanti += val
    else if (row.metodo === 'BONIFICO') totaleBonifico += val
    else if (row.metodo === 'POS')      totalePos      += val
    else if (row.metodo === 'ASSEGNO')  totaleAssegno  += val
    else                                totaleAltro    += val
  }

  return {
    contanti: Number(totaleContanti.toFixed(2)),
    bonifico: Number(totaleBonifico.toFixed(2)),
    pos:      Number(totalePos.toFixed(2)),
    assegno:  Number(totaleAssegno.toFixed(2)),
    altro:    Number(totaleAltro.toFixed(2)),
    totale:   Number((totaleContanti + totaleBonifico + totalePos + totaleAssegno + totaleAltro).toFixed(2)),
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
    })
    .from(payments)
    .innerJoin(accountingEntries, eq(accountingEntries.paymentId, payments.id))
    .where(
      and(
        eq(payments.richiedeFattura, true),
        eq(accountingEntries.fatturaEmessa, false),
      )
    ),
    // Movimenti manuali con "richiede fattura" (es. Proventi diversi): niente payment collegato.
    // Solo ENTRATE: le fatture si emettono, non si ricevono.
    db.select().from(accountingEntries).where(
      and(
        eq(accountingEntries.tipo, 'ENTRATA'),
        eq(accountingEntries.richiedeFattura, true),
        eq(accountingEntries.fatturaEmessa, false),
        isNull(accountingEntries.paymentId),
      )
    ),
  ])

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
  }))

  return [...daPagamenti, ...manualiMapped]
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
    .where(and(eq(accountingEntries.tipo, 'ENTRATA'), eq(accountingEntries.fatturaEmessa, true)))

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

  let entrate = 0
  let uscite = 0
  for (const r of rows) {
    if (r.tipo === 'ENTRATA') entrate = parseFloat(r.totale)
    else uscite = parseFloat(r.totale)
  }
  const r2 = (n: number) => Number(n.toFixed(2))
  return { entrate: r2(entrate), uscite: r2(uscite) }
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
      categoria:       'proventi_diversi',
      descrizione:     data.descrizione,
      richiedeFattura: data.richiedeFattura ?? true,
    }).returning()
    if (!entrata) throw new Error('Creazione movimento entrata fallita')

    const [uscita] = await tx.insert(accountingEntries).values({
      ...base,
      tipo:          'USCITA',
      categoria:     'costi_proventi_diversi',
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

export async function getNetMargin(startDate: Date, endDate: Date) {
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
    if (row.tipo === 'ENTRATA')       entrate = parseFloat(row.totale)
    else if (row.tipo === 'USCITA')   uscite  = parseFloat(row.totale)
  }

  return {
    entrate: Number(entrate.toFixed(2)),
    uscite:  Number(uscite.toFixed(2)),
    margine: Number((entrate - uscite).toFixed(2)),
  }
}

// ─────────────────────────────────────────────
// PREVISIONI — Crediti e Debiti manuali
// ─────────────────────────────────────────────
export async function getPrevisioni(startDate?: Date, endDate?: Date) {
  const conditions = [inArray(accountingEntries.tipo, ['CREDITO', 'DEBITO']) as any]
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
    if (row.tipo === 'CREDITO') crediti = parseFloat(row.totale)
    else if (row.tipo === 'DEBITO')  debiti = parseFloat(row.totale)
  }

  return {
    crediti: Number(crediti.toFixed(2)),
    debiti:  Number(debiti.toFixed(2)),
  }
}

// ─────────────────────────────────────────────
// MOVIMENTI PER METODO — Entrate E Uscite separate per ogni metodo, nel periodo.
// Serve alle card "per metodo": ognuna mostra quanto è entrato e quanto è uscito.
// ─────────────────────────────────────────────

type EntrateUscite = { entrate: number; uscite: number }

export async function getMovimentiPerMetodo(startDate?: Date, endDate?: Date) {
  const conditions = [
    inArray(accountingEntries.tipo, ['ENTRATA', 'USCITA']) as any,
    // I proventi diversi non sono cassa reale: fuori da "per metodo" e saldi cassa
    or(isNull(accountingEntries.categoria), notInArray(accountingEntries.categoria, CATEGORIE_PROVENTI)) as any,
  ]
  if (startDate) conditions.push(gte(accountingEntries.data, startDate) as any)
  if (endDate)   conditions.push(lte(accountingEntries.data, endDate) as any)

  const rows = await db
    .select({
      metodo: accountingEntries.metodoPagamento,
      tipo:   accountingEntries.tipo,
      totale: sql<string>`COALESCE(SUM(${accountingEntries.importo}::numeric), 0)::text`,
    })
    .from(accountingEntries)
    .where(and(...(conditions as [any, ...any[]])))
    .groupBy(accountingEntries.metodoPagamento, accountingEntries.tipo)

  const vuoto = (): EntrateUscite => ({ entrate: 0, uscite: 0 })
  const acc: Record<string, EntrateUscite> = {
    CONTANTI: vuoto(), BONIFICO: vuoto(), POS: vuoto(), ASSEGNO: vuoto(), ALTRO: vuoto(),
  }

  for (const row of rows) {
    const metodo = (row.metodo && acc[row.metodo]) ? row.metodo : 'ALTRO'
    const val = parseFloat(row.totale)
    if (row.tipo === 'ENTRATA')     acc[metodo]!.entrate += val
    else if (row.tipo === 'USCITA') acc[metodo]!.uscite  += val
  }

  const r2 = (n: number) => Number(n.toFixed(2))
  const totale: EntrateUscite = { entrate: 0, uscite: 0 }
  for (const k of Object.keys(acc)) {
    totale.entrate += acc[k]!.entrate
    totale.uscite  += acc[k]!.uscite
  }

  const conv = (e: EntrateUscite): EntrateUscite => ({ entrate: r2(e.entrate), uscite: r2(e.uscite) })

  return {
    contanti: conv(acc.CONTANTI!),
    bonifico: conv(acc.BONIFICO!),
    pos:      conv(acc.POS!),
    assegno:  conv(acc.ASSEGNO!),
    altro:    conv(acc.ALTRO!),
    totale:   conv(totale),
  }
}

// ─────────────────────────────────────────────
// SALDI DI CASSA — Rimanenze REALI (sempre dall'inizio attività, non per periodo).
//   contanti = entrate − uscite in CONTANTI (quanto c'è nel cassetto)
//   banca    = entrate − uscite di POS + BONIFICO + ASSEGNO (quanto c'è in banca)
// ─────────────────────────────────────────────

export async function getSaldiCassa() {
  const pm = await getMovimentiPerMetodo() // tutto lo storico

  const contanti = Number((pm.contanti.entrate - pm.contanti.uscite).toFixed(2))

  const bancaEntrate = pm.pos.entrate + pm.bonifico.entrate + pm.assegno.entrate
  const bancaUscite  = pm.pos.uscite  + pm.bonifico.uscite  + pm.assegno.uscite
  const banca = Number((bancaEntrate - bancaUscite).toFixed(2))

  return { contanti, banca }
}

// ─────────────────────────────────────────────
// BREAKDOWN MARKETING — Entrate/Uscite categoria 'marketing' vs tutto il resto.
// Il "resto" (doposcuola) è calcolato lato getDashboard: periodo - marketing.
// ─────────────────────────────────────────────

export async function getBreakdownMarketing(startDate: Date, endDate: Date) {
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
        eq(accountingEntries.categoria, 'marketing'),
      )
    )
    .groupBy(accountingEntries.tipo)

  let mktE = 0
  let mktU = 0
  for (const r of rows) {
    if (r.tipo === 'ENTRATA') mktE = parseFloat(r.totale)
    else mktU = parseFloat(r.totale)
  }
  const r2 = (n: number) => Number(n.toFixed(2))
  return { entrate: r2(mktE), uscite: r2(mktU), margine: r2(mktE - mktU) }
}

// ─────────────────────────────────────────────
// DASHBOARD — GET /api/accounting/dashboard
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// COSTI FISSI — Spese mensili configurate in Impostazioni
// ─────────────────────────────────────────────
export async function getCostiFissi(): Promise<number> {
  try {
    const [row] = await db
      .select({ value: systemConfigs.value })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, 'spese_fisse'))
      .limit(1)

    if (!row?.value) return 0
    const spese: { nome: string; importo: number }[] = JSON.parse(row.value)
    return spese.reduce((sum, s) => sum + (Number(s.importo) || 0), 0)
  } catch {
    return 0
  }
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
  const [periodo, perMetodo, saldiCassa, fattureInAttesa, previsioni, marketing, costiFissiMensili, fatturato, proventiDiversi] = await Promise.all([
    getNetMargin(startDate, endDate),
    getMovimentiPerMetodo(startDate, endDate),
    getSaldiCassa(),
    getPendingInvoices(),
    getPrevisioni(),
    getBreakdownMarketing(startDate, endDate),
    getCostiFissi(),
    getFatturato(),
    getProventiDiversiTotali(startDate, endDate),
  ])

  const r2 = (n: number) => Number(n.toFixed(2))
  // periodo (getNetMargin) esclude già i proventi diversi → nessuna sottrazione qui
  const doposcuola = {
    entrate: r2(periodo.entrate - marketing.entrate),
    uscite:  r2(periodo.uscite  - marketing.uscite),
    margine: r2(periodo.margine - marketing.margine),
  }

  // Costi fissi proporzionati ai mesi di calendario realmente coperti dal periodo
  const mesiNelPeriodo = mesiCalendario(startDate, endDate)
  const costiFissiPeriodo = r2(costiFissiMensili * mesiNelPeriodo)
  const breakEven = r2(periodo.margine - costiFissiPeriodo)

  return {
    periodo,
    perMetodo,
    saldiCassa,
    previsioni,
    fattureInAttesa: { count: fattureInAttesa.length, lista: fattureInAttesa },
    fatturato,
    proventiDiversi,
    breakdown: { doposcuola, marketing },
    costiFissi: {
      mensili: costiFissiMensili,
      periodo: costiFissiPeriodo,
      mesi: Math.round(mesiNelPeriodo * 10) / 10,
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

  if (mode === 'storno') {
    const storno = await reverseTransaction(entryId, motivo)
    // Coppia "Proventi diversi": lo storno deve riguardare entrambe le gambe,
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
  // Movimento manuale
  await db.delete(accountingEntries).where(eq(accountingEntries.id, entryId))
  return { ok: true }
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
    throw new Error('Movimento accoppiato "Proventi diversi": per correggerlo elimina la coppia e ricreala.')
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

  const [updated] = await db.update(accountingEntries).set(changes as any).where(eq(accountingEntries.id, entryId)).returning()
  return updated
}
