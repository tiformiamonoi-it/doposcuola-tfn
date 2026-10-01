// Analytics per la dashboard admin: guadagno atteso per giorno/periodo,
// guadagno effettivo a mese chiuso, KPI del mese corrente vs precedente.
//
// "Guadagno atteso" = stessa formula del "Ricavo stim." del calendario
// (app/pages/calendario/index.vue): per ogni lezione,
//   Σ alunni (prezzoTotale ÷ oreAcquistate × oreScalate) − compensoTutor.
// Le ricariche aumentano sia prezzo che ore, quindi la tariffa "blended" è stabile.
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { lessons, lessonStudents, packages, students, users } from '../database/schema'
import { getNetMargin } from './accounting.service'
import { oggiRomeStr } from '../utils/tutor-time-window'
import { ricavoOrarioPacchetto } from '#shared/tariffe'

// ─────────────────────────────────────────────
// GUADAGNO ATTESO per giorno in un intervallo
// ─────────────────────────────────────────────
export async function getGuadagnoAtteso(start: string, end: string) {
  const [ricaviRows, compensiRows] = await Promise.all([
    // Ricavo lordo stimato per giorno (valore delle ore scalate ai prezzi dei pacchetti).
    // Il CASE replica ricavoOrarioPacchetto() di #shared/tariffe: stessa precedenza ovunque.
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

  if (end >= oggiRomeStr()) {
    throw new Error('Il mese non è ancora concluso: il guadagno effettivo si calcola solo a mese finito')
  }

  const [rows, tutorRows] = await Promise.all([
    db.select({
      packageId:     packages.id,
      nomePacchetto: packages.nome,
      studente:      sql<string>`${students.firstName} || ' ' || ${students.lastName}`,
      lessonId:      lessons.id,
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
      .innerJoin(students, eq(students.id, lessonStudents.studentId))
      .where(and(gte(lessons.data, start), lte(lessons.data, end))),
    // Compensi per tutor; le lezioni senza alunni pesano solo come costo
    db.select({
      tutor:            sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      lezioni:          sql<string>`COUNT(*)::text`,
      lezioniSenzaAlunni: sql<string>`COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM ${lessonStudents} WHERE ${lessonStudents.lessonId} = ${lessons.id}))::text`,
      lezioniSenzaCompenso: sql<string>`COUNT(*) FILTER (WHERE ${lessons.compensoTutor} IS NULL)::text`,
      compensi:         sql<string>`COALESCE(SUM(${lessons.compensoTutor}::numeric), 0)::text`,
    })
      .from(lessons)
      .innerJoin(users, eq(users.id, lessons.tutorId))
      .where(and(gte(lessons.data, start), lte(lessons.data, end)))
      .groupBy(users.id, users.firstName, users.lastName),
  ])

  const adesso = Date.now()
  const r2 = (n: number) => Number(n.toFixed(2))

  // Una riga per pacchetto: tutti i numeri che entrano nel calcolo
  const perPacchetto = new Map<string, {
    studente: string; pacchetto: string; tipo: string
    stato: 'CONSUMO' | 'IN_CORSO' | 'FINITO'; motivo: string
    prezzo: number; oreAcquistate: number; oreResidue: number; oreConsumate: number
    lezioni: Set<string>; oreMese: number
    tariffaStandard: number; tariffaEffettiva: number
  }>()

  for (const row of rows) {
    let p = perPacchetto.get(row.packageId)
    if (!p) {
      const prezzo = parseFloat(row.prezzoTotale)
      const acquistate = parseFloat(row.oreAcquistate)
      const residue = parseFloat(row.oreResiduo)
      const consumate = acquistate - residue
      const tariffaStandard = ricavoOrarioPacchetto(prezzo, acquistate, row.tariffaOraria ? parseFloat(row.tariffaOraria) : null)

      let stato: 'CONSUMO' | 'IN_CORSO' | 'FINITO'
      let motivo: string
      if (row.tipo === 'A_CONSUMO') {
        // Pagato all'ora: il valore dell'ora non cambia mai
        stato = 'CONSUMO'; motivo = 'a consumo: vale sempre la sua tariffa'
      } else if (residue <= 0) {
        stato = 'FINITO'; motivo = 'ore esaurite'
      } else if (row.stati.includes('CHIUSO')) {
        stato = 'FINITO'; motivo = 'chiuso'
      } else if (row.dataScadenza !== null && row.dataScadenza.getTime() < adesso) {
        stato = 'FINITO'; motivo = `scaduto il ${row.dataScadenza.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })}`
      } else {
        // Valore provvisorio finché il pacchetto è in corso
        stato = 'IN_CORSO'; motivo = 'ancora in corso: vale la tariffa standard'
      }

      const tariffaEffettiva = stato === 'FINITO' && consumate > 0 ? prezzo / consumate : tariffaStandard
      p = {
        studente: row.studente, pacchetto: row.nomePacchetto, tipo: row.tipo, stato, motivo,
        prezzo, oreAcquistate: acquistate, oreResidue: residue, oreConsumate: consumate,
        lezioni: new Set(), oreMese: 0, tariffaStandard, tariffaEffettiva,
      }
      perPacchetto.set(row.packageId, p)
    }
    p.lezioni.add(row.lessonId)
    p.oreMese += parseFloat(row.oreScalate)
  }

  const pacchetti = [...perPacchetto.values()]
    .map(p => {
      const ricavoStandard = p.tariffaStandard * p.oreMese
      const ricavoEffettivo = p.tariffaEffettiva * p.oreMese
      return {
        studente: p.studente, pacchetto: p.pacchetto, tipo: p.tipo, stato: p.stato, motivo: p.motivo,
        prezzo: r2(p.prezzo), oreAcquistate: p.oreAcquistate, oreResidue: p.oreResidue, oreConsumate: r2(p.oreConsumate),
        lezioniMese: p.lezioni.size, oreMese: r2(p.oreMese),
        tariffaStandard: r2(p.tariffaStandard), tariffaEffettiva: r2(p.tariffaEffettiva),
        ricavoStandard: r2(ricavoStandard), ricavoEffettivo: r2(ricavoEffettivo),
        differenza: r2(ricavoEffettivo - ricavoStandard),
        // valori non arrotondati per i totali
        _std: ricavoStandard, _eff: ricavoEffettivo,
      }
    })
    .sort((a, b) => a.studente.localeCompare(b.studente, 'it'))

  const ricavoAtteso = pacchetti.reduce((s, p) => s + p._std, 0)
  const ricavoEffettivo = pacchetti.reduce((s, p) => s + p._eff, 0)

  const tutor = tutorRows
    .map(t => ({
      tutor: t.tutor,
      lezioni: Number(t.lezioni),
      lezioniSenzaAlunni: Number(t.lezioniSenzaAlunni),
      lezioniSenzaCompenso: Number(t.lezioniSenzaCompenso),
      compensi: r2(parseFloat(t.compensi)),
    }))
    .sort((a, b) => b.compensi - a.compensi)
  const compensi = tutorRows.reduce((s, t) => s + parseFloat(t.compensi), 0)

  const atteso = r2(ricavoAtteso - compensi)
  const effettivo = r2(ricavoEffettivo - compensi)

  return {
    atteso,
    effettivo,
    differenza: r2(effettivo - atteso),
    pacchettiAncoraAperti: pacchetti.filter(p => p.stato === 'IN_CORSO').length,
    dettaglio: {
      ricavoStandard: r2(ricavoAtteso),
      ricavoEffettivo: r2(ricavoEffettivo),
      compensi: r2(compensi),
      oreTotali: r2(pacchetti.reduce((s, p) => s + p.oreMese, 0)),
      pacchetti: pacchetti.map(({ _std, _eff, ...p }) => p),
      tutor,
    },
  }
}

// ─────────────────────────────────────────────
// KPI MESE — corrente (parziale) vs precedente (intero)
// ─────────────────────────────────────────────
export async function getKpiMese() {
  const oggi = oggiRomeStr()
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
