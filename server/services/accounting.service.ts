import { db } from '../database/client'
import { accountingEntries, payments, systemConfigs } from '../database/schema'
import { and, desc, eq, gte, inArray, isNull, lte, notInArray, or, sql } from 'drizzle-orm'
import { getNeutralKeys } from '../utils/categorie'
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
  return await db
    .select({
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
    )
    .orderBy(desc(payments.dataPagamento))
}

// ─────────────────────────────────────────────
// MARGINE NETTO — Rendiconto periodico
// Calcola: ENTRATE totali - USCITE totali nel periodo specificato.
// Esclude movimenti di tipo NOTA (informativi, non incidono sul saldo).
// ─────────────────────────────────────────────

export async function getNetMargin(startDate: Date, endDate: Date) {
  // E3: le categorie "neutre" (giroconti, saldo iniziale…) sono escluse dal margine.
  // L'elenco è configurabile da Impostazioni → Categorie.
  const neutre = await getNeutralKeys()

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
        neutre.length
          ? or(isNull(accountingEntries.categoria), notInArray(accountingEntries.categoria, neutre))
          : undefined,
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
  const conditions = [inArray(accountingEntries.tipo, ['ENTRATA', 'USCITA']) as any]
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

export async function getDashboard(startDate: Date, endDate: Date) {
  const [periodo, perMetodo, saldiCassa, fattureInAttesa, previsioni, marketing, costiFissiMensili] = await Promise.all([
    getNetMargin(startDate, endDate),
    getMovimentiPerMetodo(startDate, endDate),
    getSaldiCassa(),
    getPendingInvoices(),
    getPrevisioni(),
    getBreakdownMarketing(startDate, endDate),
    getCostiFissi(),
  ])

  const r2 = (n: number) => Number(n.toFixed(2))
  const doposcuola = {
    entrate: r2(periodo.entrate - marketing.entrate),
    uscite:  r2(periodo.uscite  - marketing.uscite),
    margine: r2(periodo.margine - marketing.margine),
  }

  // Calcola i mesi nel periodo per proporzionare i costi fissi (media 30.44 gg/mese)
  const msStart = startDate.getTime()
  const msEnd = endDate.getTime()
  const giorniNelPeriodo = (msEnd - msStart) / (1000 * 60 * 60 * 24)
  const mesiNelPeriodo = Math.max(0.03, giorniNelPeriodo / 30.44) // min ~1 giorno
  const costiFissiPeriodo = r2(costiFissiMensili * mesiNelPeriodo)
  const breakEven = r2(periodo.margine - costiFissiPeriodo)

  return {
    periodo,
    perMetodo,
    saldiCassa,
    previsioni,
    fattureInAttesa: { count: fattureInAttesa.length, lista: fattureInAttesa },
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
    return await reverseTransaction(entryId, motivo)
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

  const changes: Record<string, unknown> = { updatedAt: new Date() }
  if (data.fatturaEmessa !== undefined)   changes.fatturaEmessa   = data.fatturaEmessa
  if (data.tipo !== undefined)            changes.tipo            = data.tipo
  if (data.importo !== undefined)         changes.importo         = String(data.importo)
  if (data.descrizione !== undefined)     changes.descrizione     = data.descrizione
  if (data.categoria !== undefined)       changes.categoria       = data.categoria
  if (data.metodoPagamento !== undefined) changes.metodoPagamento = data.metodoPagamento
  if (data.data !== undefined)            changes.data            = new Date(data.data)

  const [updated] = await db.update(accountingEntries).set(changes as any).where(eq(accountingEntries.id, entryId)).returning()
  return updated
}
