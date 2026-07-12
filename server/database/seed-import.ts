/**
 * SEED DEFINITIVO — importa i dati reali da dump-old.sql (radice progetto) nel nuovo DB.
 * Uso:
 *   npx tsx server/database/seed-import.ts --dry-run   → solo lettura + report, non tocca il DB
 *   npx tsx server/database/seed-import.ts             → svuota e ricarica (dentro 1 transazione)
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { db } from './client'
import * as schema from './schema'
import { parseDump, type CopyBlock } from './seed/parse-copy'
import { tx, buildMezzaLezioneMap, buildMetodoMaps, toDate, type MetodoMaps } from './seed/transforms'
import { computePackageStates } from '../services/package.service'
import { SALDI_OBIETTIVO, CHECKPOINT_RICONCILIAZIONE } from '#shared/riconciliazione'

const DRY_RUN = process.argv.includes('--dry-run')

// I movimenti contabili PRIMA di questa data vengono saltati (contabilità parte dal 2026).
const SOGLIA_MOVIMENTI = new Date('2026-01-01T00:00:00Z')
function movimentoDal2026(r: Record<string, string | null>): boolean {
  const d = toDate(r.data)
  return d !== null && d >= SOGLIA_MOVIMENTI
}

// CHECKPOINT: saldi reali VERIFICATI fisicamente all'import di giugno (14/06/2026).
// La rettifica di apertura viene calcolata SOLO sui movimenti prima del checkpoint
// (i metodi di alcuni movimenti storici erano sbagliati: ~€1880 "banca" erano contanti).
// I movimenti dal 15/06 in poi fluiscono così come sono: le loro eventuali differenze
// si sistemano a mano nella pagina Riconciliazione, che chiude sui saldi obiettivo
// SALDI_OBIETTIVO (€1.371,53 / €8.195,47, verificati l'11/07/2026).
const TARGET_CONTANTI = 381.00
const TARGET_BANCA = 6223.00
const CHECKPOINT = new Date(`${CHECKPOINT_RICONCILIAZIONE}T00:00:00Z`)
const DATA_RETTIFICA = new Date('2026-01-01T00:00:00Z')

function saldoCassaBanca(entries: Array<{ tipo: string; importo: string; metodoPagamento: any }>) {
  let contanti = 0
  let banca = 0
  for (const e of entries) {
    const segno = e.tipo === 'ENTRATA' ? 1 : e.tipo === 'USCITA' ? -1 : 0
    if (segno === 0) continue
    const imp = parseFloat(e.importo)
    if (e.metodoPagamento === 'CONTANTI') contanti += segno * imp
    else if (e.metodoPagamento === 'POS' || e.metodoPagamento === 'BONIFICO' || e.metodoPagamento === 'ASSEGNO') banca += segno * imp
  }
  return { contanti, banca }
}

// Costruisce un movimento di rettifica (ENTRATA se delta>0, USCITA se delta<0).
function rettifica(id: string, delta: number, metodo: string, now: Date) {
  return {
    id,
    tipo: delta >= 0 ? 'ENTRATA' : 'USCITA',
    importo: Math.abs(delta).toFixed(2),
    descrizione: 'Rettifica apertura 2026 — riclassifica metodo (cassa/banca)',
    categoria: 'rettifica',
    data: DATA_RETTIFICA,
    packageId: null, lessonId: null, paymentId: null, tutorPaymentId: null, reimbursementId: null,
    metodoPagamento: metodo as any,
    fatturaEmessa: false,
    note: 'Allinea i saldi alla cassa reale verificata (metodi sbagliati nei dati storici).',
    createdAt: now, updatedAt: now,
  }
}

function dumpPath(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  return resolve(here, '../../dump-old.sql')
}

// Ordine di INSERIMENTO (rispetta le dipendenze). Il TRUNCATE userà CASCADE quindi non serve l'ordine inverso.
type Step = { table: string; drizzle: any; transform: (r: any) => any }
function buildSteps(mezza: Map<string, boolean>, metodoMaps: MetodoMaps): Step[] {
  return [
    { table: 'users',                drizzle: schema.users,               transform: tx.users },
    { table: 'tutor_profiles',       drizzle: schema.tutorProfiles,       transform: tx.tutor_profiles },
    { table: 'time_slots',           drizzle: schema.timeSlots,           transform: tx.time_slots },
    { table: 'standard_packages',    drizzle: schema.standardPackages,    transform: tx.standard_packages },
    { table: 'closure_dates',        drizzle: schema.closureDates,        transform: tx.closure_dates },
    { table: 'system_configs',       drizzle: schema.systemConfigs,       transform: tx.system_configs },
    { table: 'students',             drizzle: schema.students,            transform: tx.students },
    { table: 'student_referrals',    drizzle: schema.studentReferrals,    transform: tx.student_referrals },
    { table: 'packages',             drizzle: schema.packages,            transform: tx.packages },
    { table: 'tutor_availabilities', drizzle: schema.tutorAvailabilities, transform: tx.tutor_availabilities },
    { table: 'tutor_payments',       drizzle: schema.tutorPayments,       transform: tx.tutor_payments },
    { table: 'tutor_reimbursements', drizzle: schema.tutorReimbursements, transform: tx.tutor_reimbursements },
    { table: 'payments',             drizzle: schema.payments,            transform: tx.payments },
    { table: 'lessons',              drizzle: schema.lessons,             transform: (r: any) => tx.lessons(r, mezza) },
    { table: 'lesson_students',      drizzle: schema.lessonStudents,      transform: tx.lesson_students },
    { table: 'accounting_entries',   drizzle: schema.accountingEntries,   transform: (r: any) => tx.accounting_entries(r, metodoMaps) },
  ]
}

// Il vecchio gestionale salvava le categorie come etichette ("Pacchetto", "Compenso Tutor"…);
// il nuovo usa chiavi stabili (shared/accounting-categories.ts). Senza questa mappa i grafici
// della Contabilità non riconoscerebbero i movimenti importati.
const CATEGORIE_MAP: Record<string, string> = {
  'Pacchetto':      'pacchetti',
  'Compenso Tutor': 'compenso_tutor',
  'Rimborso Tutor': 'rimborso_tutor',
  'Marketing':      'marketing',
}

// Tabelle svuotate dal seed (tutte quelle gestite + le 3 nuove vuote + bookings saltate).
const TRUNCATE_TABLES = [
  'accounting_entries', 'lesson_students', 'lessons', 'payments', 'package_recharges',
  'tutor_reimbursements', 'tutor_payments', 'tutor_availabilities', 'packages', 'student_referrals',
  'student_notes', 'students', 'booking_subjects', 'bookings', 'system_configs', 'closure_dates',
  'standard_packages', 'time_slots', 'tutor_profiles', 'contact_requests', 'users',
]

function rowsFor(blocks: Map<string, CopyBlock>, table: string) {
  return blocks.get(table)?.rows ?? []
}

async function main() {
  const fileSql = readFileSync(dumpPath(), 'utf8')
  const blocks = parseDump(fileSql)
  const mezza = buildMezzaLezioneMap(rowsFor(blocks, 'lesson_students'))
  const metodoMaps = buildMetodoMaps(
    rowsFor(blocks, 'payments'),
    rowsFor(blocks, 'tutor_payments'),
    rowsFor(blocks, 'tutor_reimbursements'),
  )
  const steps = buildSteps(mezza, metodoMaps)

  // Validazione: lezioni senza orario (timeSlotId NOT NULL nel nuovo schema).
  const lessonsNoSlot = rowsFor(blocks, 'lessons').filter((r) => r.timeSlotId === null)
  if (lessonsNoSlot.length > 0) {
    console.log(`\n⚠️  ${lessonsNoSlot.length} lezioni SENZA orario assegnato (timeSlotId mancante):`)
    lessonsNoSlot.forEach((r) => console.log('   - lesson id', r.id))
    console.log('   Queste righe NON possono essere importate finché non si decide un orario.')
  }

  // Pre-trasformazione (anche in dry-run): se una trasformazione lancia, lo si vede subito.
  // I movimenti contabili prima del 2026 vengono saltati (contabilità parte dal 2026).
  const prepared = steps.map((s) => {
    let rows = rowsFor(blocks, s.table)
    if (s.table === 'accounting_entries') {
      const prima = rows.length
      rows = rows.filter(movimentoDal2026)
      console.log(`⏭️  Movimenti pre-2026 saltati: ${prima - rows.length} (su ${prima})`)
    }
    return { step: s, values: rows.map(s.transform) }
  })

  // ── RICALCOLO giorniResiduo dei pacchetti MENSILI dalle giornate effettivamente frequentate ──
  // L'import copiava il valore vecchio (spesso sballato). Regola corretta: 1 giorno consumato
  // per ogni GIORNATA distinta in cui l'alunno è venuto (indipendentemente dalle ore).
  {
    const lessonDate = new Map<string, string>()
    for (const l of rowsFor(blocks, 'lessons')) {
      if (l.id && l.data) lessonDate.set(l.id, l.data.slice(0, 10))
    }
    const giornateFrequentate = new Map<string, Set<string>>()
    for (const ls of rowsFor(blocks, 'lesson_students')) {
      if (!ls.packageId || !ls.lessonId) continue
      const d = lessonDate.get(ls.lessonId)
      if (!d) continue
      if (!giornateFrequentate.has(ls.packageId)) giornateFrequentate.set(ls.packageId, new Set())
      giornateFrequentate.get(ls.packageId)!.add(d)
    }

    const pkgStep = prepared.find((p) => p.step.table === 'packages')
    let corretti = 0
    if (pkgStep) {
      for (const pkg of pkgStep.values) {
        if (pkg.tipo !== 'MENSILE') continue
        const tot = pkg.giorniAcquistati ?? 0
        if (!tot) continue
        const usati = giornateFrequentate.get(pkg.id)?.size ?? 0
        const nuovoResiduo = Math.max(0, tot - usati)
        if (nuovoResiduo !== pkg.giorniResiduo) {
          if (DRY_RUN && corretti < 12) console.log(`   • ${pkg.nome}: ${tot} acquistati − ${usati} frequentati → ${nuovoResiduo} residui  (prima era ${pkg.giorniResiduo})`)
          pkg.giorniResiduo = nuovoResiduo
          // Ricalcola gli stati: un pacchetto a 0 giorni dev'essere ESAURITO/CHIUSO.
          pkg.stati = computePackageStates({
            oreAcquistate:  pkg.oreAcquistate,
            oreResiduo:     pkg.oreResiduo,
            importoResiduo: pkg.importoResiduo,
            dataScadenza:   pkg.dataScadenza,
            giorniResiduo:  nuovoResiduo,
          })
          corretti++
        }
      }
    }
    console.log(`📅 giorniResiduo MENSILI ricalcolati dalle presenze: ${corretti} pacchetti corretti`)
  }

  // ── CATEGORIE: dalle etichette del vecchio sistema alle chiavi del nuovo ──
  {
    const accPrep = prepared.find((p) => p.step.table === 'accounting_entries')
    let normalizzate = 0
    for (const e of accPrep?.values ?? []) {
      const nuova = e.categoria ? CATEGORIE_MAP[e.categoria] : undefined
      if (nuova) { e.categoria = nuova; normalizzate++ }
    }
    console.log(`🏷️  Categorie normalizzate (Pacchetto→pacchetti, ecc.): ${normalizzate} movimenti`)
  }

  // ── PRO BONO: valorizza l'importo reale condonato (nel vecchio sistema era sempre 0) ──
  // condono = floor(Σ compensi lezioni del tutor nel mese) − Σ pagato per quel mese.
  // Status resta PRO_BONO e NON viene creato alcun movimento contabile (soldi mai usciti).
  {
    const compensoMese = new Map<string, number>() // "tutorId|YYYY-MM" → Σ compensoTutor
    for (const l of rowsFor(blocks, 'lessons')) {
      if (!l.tutorId || !l.data || !l.compensoTutor) continue
      const key = `${l.tutorId}|${l.data.slice(0, 7)}`
      compensoMese.set(key, (compensoMese.get(key) ?? 0) + parseFloat(l.compensoTutor))
    }
    const pagatoMese = new Map<string, number>() // le righe PRO_BONO valgono 0, non inquinano
    for (const p of rowsFor(blocks, 'tutor_payments')) {
      if (!p.tutorId || !p.mese) continue
      const key = `${p.tutorId}|${p.mese.slice(0, 7)}`
      pagatoMese.set(key, (pagatoMese.get(key) ?? 0) + parseFloat(p.importo ?? '0'))
    }
    const tutorName = new Map<string, string>()
    for (const u of rowsFor(blocks, 'users')) tutorName.set(u.id!, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim())

    const tpStep = prepared.find((p) => p.step.table === 'tutor_payments')
    let totCondono = 0
    let righeCondono = 0
    console.log('\n💛 PRO BONO — importi reali condonati:')
    for (const tp of tpStep?.values ?? []) {
      if (tp.status !== 'PRO_BONO') continue
      const meseKey = tp.mese.toISOString().slice(0, 7)
      const key = `${tp.tutorId}|${meseKey}`
      const calcolato = Math.floor(compensoMese.get(key) ?? 0)
      const pagato = pagatoMese.get(key) ?? 0
      const condono = Math.max(0, Number((calcolato - pagato).toFixed(2)))
      if (condono <= 0) continue
      tp.importo = condono.toFixed(2)
      tp.note = `${tp.note ? tp.note + ' ' : ''}[condonati €${condono.toFixed(2)}]`
      totCondono += condono
      righeCondono++
      console.log(`   • ${tutorName.get(tp.tutorId) ?? tp.tutorId}  ${meseKey}  calcolato ${calcolato} − pagato ${pagato.toFixed(2)} → condono €${condono.toFixed(2)}`)
    }
    console.log(`   Totale: ${righeCondono} righe, €${totCondono.toFixed(2)} condonati`)
  }

  // ── RIMBORSI: allinea il movimento contabile all'importo effettivamente pagato ──
  // (nel vecchio sistema il movimento poteva restare all'importo richiesto, es. Ganci 189 vs 169)
  const accStep = prepared.find((p) => p.step.table === 'accounting_entries')
  {
    const pagatoRimborso = new Map<string, string>()
    for (const r of rowsFor(blocks, 'tutor_reimbursements')) {
      if (r.id && r.importoPagato) pagatoRimborso.set(r.id, parseFloat(r.importoPagato).toFixed(2))
    }
    const perRimborso = new Map<string, any[]>()
    for (const e of accStep?.values ?? []) {
      if (!e.reimbursementId) continue
      if (!perRimborso.has(e.reimbursementId)) perRimborso.set(e.reimbursementId, [])
      perRimborso.get(e.reimbursementId)!.push(e)
    }
    for (const [rimborsoId, entries] of perRimborso) {
      const pagato = pagatoRimborso.get(rimborsoId)
      if (!pagato) continue
      if (entries.length > 1) {
        console.log(`⚠️  Rimborso ${rimborsoId}: ${entries.length} movimenti collegati, non allineo automaticamente`)
        continue
      }
      const entry = entries[0]!
      if (parseFloat(entry.importo).toFixed(2) !== pagato) {
        console.log(`🔧 Rimborso: movimento "${entry.descrizione}" corretto ${entry.importo} → ${pagato}`)
        entry.importo = pagato
      }
    }
  }

  // ── RETTIFICA DI APERTURA: allinea cassa/banca ai saldi del CHECKPOINT (14/06/2026) ──
  // Calcolata SOLO sui movimenti prima del checkpoint: quelli successivi fluiscono raw
  // e si riconciliano a mano nella pagina Riconciliazione.
  if (accStep) {
    const preCheckpoint = accStep.values.filter((e) => e.data < CHECKPOINT)
    const { contanti, banca } = saldoCassaBanca(preCheckpoint)
    const deltaContanti = Number((TARGET_CONTANTI - contanti).toFixed(2))
    const deltaBanca = Number((TARGET_BANCA - banca).toFixed(2))
    const now = new Date()
    if (Math.abs(deltaContanti) >= 0.005) accStep.values.push(rettifica('rett-apertura-contanti-2026', deltaContanti, 'CONTANTI', now))
    if (Math.abs(deltaBanca) >= 0.005) accStep.values.push(rettifica('rett-apertura-banca-2026', deltaBanca, 'BONIFICO', now))
    console.log(`\n🧾 Rettifica apertura (checkpoint 14/06: pre-checkpoint → ${TARGET_CONTANTI.toFixed(2)}/${TARGET_BANCA.toFixed(2)}) → contanti ${deltaContanti >= 0 ? '+' : ''}${deltaContanti.toFixed(2)} · banca ${deltaBanca >= 0 ? '+' : ''}${deltaBanca.toFixed(2)}`)
  }

  // Proiezione saldi finali (identica a come li calcola la pagina Contabilità).
  const stampaSaldiAttesi = () => {
    const saldo = saldoCassaBanca(accStep?.values ?? [])
    console.log('\n=== SALDI DOPO L\'IMPORT (rettifica checkpoint inclusa) ===')
    console.log(`  Cassa contanti: € ${saldo.contanti.toFixed(2)}   (atteso ≈ € 1.204,54)`)
    console.log(`  Cassa banca:    € ${saldo.banca.toFixed(2)}   (atteso ≈ € 8.384,86)`)
    console.log(`  Obiettivo finale (dopo riconciliazione manuale): € ${SALDI_OBIETTIVO.contanti.toFixed(2)} / € ${SALDI_OBIETTIVO.banca.toFixed(2)}`)
    console.log(`  Delta da chiudere nella pagina Riconciliazione:  contanti ${(SALDI_OBIETTIVO.contanti - saldo.contanti).toFixed(2)} · banca ${(SALDI_OBIETTIVO.banca - saldo.banca).toFixed(2)}`)
  }

  // ── CONFIG DEL NUOVO GESTIONALE: conservate attraverso lo svuotamento ──
  // Le impostazioni create dal nuovo gestionale (categorie contabili, tariffe tutor,
  // spese fisse, materie…) non esistono nel dump: senza questo passaggio andrebbero perse.
  const dumpConfigKeys = new Set(rowsFor(blocks, 'system_configs').map((r) => r.key))
  const configDaConservare = (await db.select().from(schema.systemConfigs))
    .filter((c) => !dumpConfigKeys.has(c.key))
  console.log(`⚙️  Config del nuovo gestionale conservate: ${configDaConservare.length} (${configDaConservare.map((c) => c.key).join(', ') || 'nessuna'})`)

  if (DRY_RUN) {
    console.log('\n=== DRY RUN — righe pronte per tabella (nessuna scrittura) ===')
    for (const p of prepared) console.log(`${String(p.values.length).padStart(6)}  ${p.step.table}`)

    stampaSaldiAttesi()

    console.log('\n[DRY RUN] Nessuna modifica al database.')
    return
  }

  // Caricamento reale dentro UNA transazione: o tutto, o niente.
  const report: Array<{ table: string; atteso: number; inserito: number }> = []
  await db.transaction(async (trx) => {
    await trx.execute(sql.raw(`TRUNCATE TABLE ${TRUNCATE_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`))
    for (const p of prepared) {
      const CHUNK = 500
      for (let i = 0; i < p.values.length; i += CHUNK) {
        const slice = p.values.slice(i, i + CHUNK)
        if (slice.length > 0) await trx.insert(p.step.drizzle).values(slice)
      }
      let atteso = p.values.length
      // Reinserisce le config del nuovo gestionale accanto a quelle del dump.
      if (p.step.table === 'system_configs' && configDaConservare.length > 0) {
        await trx.insert(schema.systemConfigs).values(configDaConservare)
        atteso += configDaConservare.length
      }
      report.push({ table: p.step.table, atteso, inserito: atteso })
    }
  })

  // Foglietto di verifica: riconta dal DB.
  console.log('\n=== FOGLIETTO DI CONTROLLO ===')
  let errori = 0
  for (const r of report) {
    const res = (await db.execute(
      sql.raw(`SELECT COUNT(*)::int AS count FROM "${r.table}"`),
    )) as unknown as Array<{ count: number }>
    const count = Number(res[0]?.count ?? -1)
    const ok = count === r.atteso
    if (!ok) errori++
    console.log(`${r.table.padEnd(24)} ${String(r.atteso).padStart(5)} → ${String(count).padStart(5)}  ${ok ? '✅' : '❌'}`)
  }
  console.log('bookings (test)'.padEnd(24) + '   18 →     0  ⏭️  saltate (volutamente)')
  console.log('─'.repeat(46))
  console.log(errori === 0 ? '✅ RISULTATO: 100% dei dati reali importati. 0 errori.'
                           : `❌ RISULTATO: ${errori} tabelle con conteggio non corrispondente.`)
  stampaSaldiAttesi()
}

main().catch((err) => {
  console.error('\n❌ ERRORE:', err)
  process.exit(1)
})
