/**
 * SEED DEFINITIVO — importa i dati reali da .old/old_database.sql nel nuovo DB.
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
import { tx, buildMezzaLezioneMap } from './seed/transforms'

const DRY_RUN = process.argv.includes('--dry-run')

function dumpPath(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  return resolve(here, '../../.old/old_database.sql')
}

// Ordine di INSERIMENTO (rispetta le dipendenze). Il TRUNCATE userà CASCADE quindi non serve l'ordine inverso.
type Step = { table: string; drizzle: any; transform: (r: any) => any }
function buildSteps(mezza: Map<string, boolean>): Step[] {
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
    { table: 'accounting_entries',   drizzle: schema.accountingEntries,   transform: tx.accounting_entries },
  ]
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
  const steps = buildSteps(mezza)

  // Validazione: lezioni senza orario (timeSlotId NOT NULL nel nuovo schema).
  const lessonsNoSlot = rowsFor(blocks, 'lessons').filter((r) => r.timeSlotId === null)
  if (lessonsNoSlot.length > 0) {
    console.log(`\n⚠️  ${lessonsNoSlot.length} lezioni SENZA orario assegnato (timeSlotId mancante):`)
    lessonsNoSlot.forEach((r) => console.log('   - lesson id', r.id))
    console.log('   Queste righe NON possono essere importate finché non si decide un orario.')
  }

  // Pre-trasformazione (anche in dry-run): se una trasformazione lancia, lo si vede subito.
  const prepared = steps.map((s) => ({
    step: s,
    values: rowsFor(blocks, s.table).map(s.transform),
  }))

  if (DRY_RUN) {
    console.log('\n=== DRY RUN — righe pronte per tabella (nessuna scrittura) ===')
    for (const p of prepared) console.log(`${String(p.values.length).padStart(6)}  ${p.step.table}`)
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
      report.push({ table: p.step.table, atteso: p.values.length, inserito: p.values.length })
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
}

main().catch((err) => {
  console.error('\n❌ ERRORE:', err)
  process.exit(1)
})
