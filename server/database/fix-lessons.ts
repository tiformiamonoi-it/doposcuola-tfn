/**
 * MANUTENZIONE — Corregge il tipo e il compenso delle lezioni con dati incoerenti.
 * (es. lezioni importate dal vecchio sistema con tipo "SINGOLA" ma 2 studenti = in realtà GRUPPO)
 *
 * Uso:
 *   npx tsx server/database/fix-lessons.ts            → SIMULAZIONE: mostra cosa cambierebbe, non tocca il DB
 *   npx tsx server/database/fix-lessons.ts --apply    → APPLICA le correzioni al database
 */
import 'dotenv/config'
import { ricalcolaTipiECompensiLezioni } from '../services/lesson.service'

const APPLY = process.argv.includes('--apply')

async function main() {
  console.log(APPLY ? '🛠️  APPLICAZIONE correzioni…\n' : '🔍 SIMULAZIONE (nessuna modifica al DB)…\n')

  const report = await ricalcolaTipiECompensiLezioni(APPLY)

  if (report.daCorreggere === 0) {
    console.log(`✅ Tutto a posto: ${report.totaleLezioni} lezioni controllate, nessuna da correggere.`)
    process.exit(0)
  }

  console.log(`Lezioni totali controllate: ${report.totaleLezioni}`)
  console.log(`Lezioni da correggere:      ${report.daCorreggere}\n`)

  let deltaCompenso = 0
  for (const c of report.changes) {
    const vecchio = Number(c.compensoVecchio ?? 0)
    const nuovo   = Number(c.compensoNuovo)
    deltaCompenso += nuovo - vecchio
    console.log(
      `  • ${c.id}  [${c.numStudenti} studenti]  ` +
      `tipo ${c.tipoVecchio} → ${c.tipoNuovo}   ` +
      `compenso €${vecchio.toFixed(2)} → €${nuovo.toFixed(2)}`
    )
  }

  console.log(`\nVariazione totale compenso tutor: €${deltaCompenso.toFixed(2)}`)

  if (APPLY) {
    console.log('\n✅ Correzioni applicate al database.')
  } else {
    console.log('\nℹ️  Questa era solo una simulazione. Per applicare davvero:')
    console.log('   npx tsx server/database/fix-lessons.ts --apply')
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Errore durante il ricalcolo:', err)
  process.exit(1)
})
