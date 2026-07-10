// Analytics per la dashboard admin: guadagno atteso per giorno/periodo,
// guadagno effettivo a mese chiuso, KPI del mese corrente vs precedente.
//
// "Guadagno atteso" = stessa formula del "Ricavo stim." del calendario
// (app/pages/calendario/index.vue): per ogni lezione,
//   Σ alunni (prezzoTotale ÷ oreAcquistate × oreScalate) − compensoTutor.
// Le ricariche aumentano sia prezzo che ore, quindi la tariffa "blended" è stabile.
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { lessons, lessonStudents, packages } from '../database/schema'
import { getNetMargin } from './accounting.service'

// Giorno civile corrente in Italia ('YYYY-MM-DD') — mai usare toISOString (è UTC)
function oggiRomaISO(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date())
}

// ─────────────────────────────────────────────
// GUADAGNO ATTESO per giorno in un intervallo
// ─────────────────────────────────────────────
export async function getGuadagnoAtteso(start: string, end: string) {
  const [ricaviRows, compensiRows] = await Promise.all([
    // Ricavo lordo stimato per giorno (valore delle ore scalate ai prezzi dei pacchetti)
    db.select({
      data: lessons.data,
      ricavo: sql<string>`COALESCE(SUM(
        CASE WHEN ${packages.oreAcquistate}::numeric > 0
             THEN ${packages.prezzoTotale}::numeric / ${packages.oreAcquistate}::numeric
             ELSE COALESCE(${packages.tariffaOraria}::numeric, 0)
        END * ${lessonStudents.oreScalate}::numeric
      ), 0)::text`,
    })
      .from(lessons)
      .innerJoin(lessonStudents, eq(lessonStudents.lessonId, lessons.id))
      .innerJoin(packages, eq(packages.id, lessonStudents.packageId))
      .where(and(gte(lessons.data, start), lte(lessons.data, end)))
      .groupBy(lessons.data),
    // Compensi tutor per giorno
    db.select({
      data: lessons.data,
      compensi: sql<string>`COALESCE(SUM(${lessons.compensoTutor}::numeric), 0)::text`,
    })
      .from(lessons)
      .where(and(gte(lessons.data, start), lte(lessons.data, end)))
      .groupBy(lessons.data),
  ])

  const perGiorno = new Map<string, { ricavo: number; compensi: number }>()
  for (const r of ricaviRows) {
    perGiorno.set(r.data, { ricavo: parseFloat(r.ricavo), compensi: 0 })
  }
  for (const c of compensiRows) {
    const g = perGiorno.get(c.data) ?? { ricavo: 0, compensi: 0 }
    g.compensi = parseFloat(c.compensi)
    perGiorno.set(c.data, g)
  }

  const giorni = [...perGiorno.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, g]) => ({ data, guadagno: Number((g.ricavo - g.compensi).toFixed(2)) }))

  const totale = Number(giorni.reduce((s, g) => s + g.guadagno, 0).toFixed(2))
  const giorniConLezioni = giorni.length

  return {
    giorni,
    totale,
    giorniConLezioni,
    // Media sui soli giorni CON lezioni (scelta confermata dall'utente)
    mediaGiornaliera: giorniConLezioni > 0 ? Number((totale / giorniConLezioni).toFixed(2)) : 0,
  }
}

// ─────────────────────────────────────────────
// GUADAGNO EFFETTIVO di un mese CONCLUSO
// Per i pacchetti a prezzo fisso (ORE/MENSILE) FINITI, il valore reale di
// un'ora è prezzo ÷ ore realmente consumate (le ore perse alzano la resa).
// I pacchetti ancora in corso restano al valore standard (conteggiati a parte).
// ─────────────────────────────────────────────
export async function getGuadagnoEffettivoMese(anno: number, mese: number) {
  const start = `${anno}-${String(mese).padStart(2, '0')}-01`
  const ultimoGiorno = new Date(anno, mese, 0).getDate() // giorno 0 del mese dopo = ultimo del mese
  const end = `${anno}-${String(mese).padStart(2, '0')}-${String(ultimoGiorno).padStart(2, '0')}`

  if (end >= oggiRomaISO()) {
    throw new Error('Il mese non è ancora concluso: il guadagno effettivo si calcola solo a mese finito')
  }

  const [rows, compensiRow] = await Promise.all([
    db.select({
      packageId:     packages.id,
      tipo:          packages.tipo,
      prezzoTotale:  packages.prezzoTotale,
      oreAcquistate: packages.oreAcquistate,
      oreResiduo:    packages.oreResiduo,
      tariffaOraria: packages.tariffaOraria,
      dataScadenza:  packages.dataScadenza,
      stati:         packages.stati,
      oreScalate:    lessonStudents.oreScalate,
    })
      .from(lessonStudents)
      .innerJoin(lessons, eq(lessons.id, lessonStudents.lessonId))
      .innerJoin(packages, eq(packages.id, lessonStudents.packageId))
      .where(and(gte(lessons.data, start), lte(lessons.data, end))),
    db.select({
      compensi: sql<string>`COALESCE(SUM(${lessons.compensoTutor}::numeric), 0)::text`,
    })
      .from(lessons)
      .where(and(gte(lessons.data, start), lte(lessons.data, end))),
  ])

  const adesso = Date.now()
  let ricavoAtteso = 0
  let ricavoEffettivo = 0
  const pacchettiAperti = new Set<string>()

  for (const row of rows) {
    const prezzo = parseFloat(row.prezzoTotale)
    const acquistate = parseFloat(row.oreAcquistate)
    const residue = parseFloat(row.oreResiduo)
    const ore = parseFloat(row.oreScalate)

    const rateAtteso = acquistate > 0 ? prezzo / acquistate : parseFloat(row.tariffaOraria ?? '0')
    ricavoAtteso += rateAtteso * ore

    if (row.tipo === 'A_CONSUMO') {
      // Pagato all'ora: il valore dell'ora non cambia mai
      ricavoEffettivo += rateAtteso * ore
      continue
    }

    const finito = residue <= 0
      || row.stati.includes('CHIUSO')
      || (row.dataScadenza !== null && row.dataScadenza.getTime() < adesso)

    if (!finito) {
      pacchettiAperti.add(row.packageId)
      ricavoEffettivo += rateAtteso * ore // valore provvisorio finché il pacchetto è in corso
      continue
    }

    const consumate = acquistate - residue
    const rateEffettivo = consumate > 0 ? prezzo / consumate : rateAtteso
    ricavoEffettivo += rateEffettivo * ore
  }

  const compensi = parseFloat(compensiRow[0]?.compensi ?? '0')
  const atteso = Number((ricavoAtteso - compensi).toFixed(2))
  const effettivo = Number((ricavoEffettivo - compensi).toFixed(2))

  return {
    atteso,
    effettivo,
    differenza: Number((effettivo - atteso).toFixed(2)),
    pacchettiAncoraAperti: pacchettiAperti.size,
  }
}

// ─────────────────────────────────────────────
// KPI MESE — corrente (parziale) vs precedente (intero)
// ─────────────────────────────────────────────
export async function getKpiMese() {
  const oggi = oggiRomaISO()
  const [annoStr, meseStr] = oggi.split('-')
  const anno = Number(annoStr)
  const mese = Number(meseStr) // 1-12

  const inizioCorrente = new Date(anno, mese - 1, 1)
  const fineCorrente = new Date(anno, mese, 0, 23, 59, 59)
  const inizioPrec = new Date(anno, mese - 2, 1)
  const finePrec = new Date(anno, mese - 1, 0, 23, 59, 59)

  const pad = (n: number) => String(n).padStart(2, '0')
  const rangeCorrente: [string, string] = [`${anno}-${pad(mese)}-01`, `${anno}-${pad(mese)}-${pad(new Date(anno, mese, 0).getDate())}`]
  const annoPrec = mese === 1 ? anno - 1 : anno
  const mesePrec = mese === 1 ? 12 : mese - 1
  const rangePrec: [string, string] = [`${annoPrec}-${pad(mesePrec)}-01`, `${annoPrec}-${pad(mesePrec)}-${pad(new Date(annoPrec, mesePrec, 0).getDate())}`]

  const contaLezioni = (range: [string, string]) =>
    db.select({ n: sql<string>`COUNT(*)::text` })
      .from(lessons)
      .where(and(gte(lessons.data, range[0]), lte(lessons.data, range[1])))

  const [margineCorrente, marginePrec, lezioniCorrente, lezioniPrec] = await Promise.all([
    getNetMargin(inizioCorrente, fineCorrente),
    getNetMargin(inizioPrec, finePrec),
    contaLezioni(rangeCorrente),
    contaLezioni(rangePrec),
  ])

  return {
    corrente:   { ...margineCorrente, lezioni: Number(lezioniCorrente[0]?.n ?? 0) },
    precedente: { ...marginePrec, lezioni: Number(lezioniPrec[0]?.n ?? 0) },
  }
}
