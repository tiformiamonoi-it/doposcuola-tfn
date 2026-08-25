/**
 * MANUTENZIONE — Corregge il tipo e il compenso delle lezioni con dati incoerenti.
 * (es. lezioni importate dal vecchio sistema con tipo "SINGOLA" ma 2 studenti = in realtà GRUPPO)
 *
 * ATTENZIONE: il ricalcolo usa le TARIFFE ATTUALI (quelle in Impostazioni). Se le hai cambiate
 * di recente, senza --da riscriveresti anche i compensi dei mesi già liquidati.
 *
 * Uso:
 *   npx tsx server/database/fix-lessons.ts                     → SIMULAZIONE: mostra cosa cambierebbe, non tocca il DB
 *   npx tsx server/database/fix-lessons.ts --da=2026-01-01     → SIMULAZIONE limitata alle lezioni dal 1° gennaio 2026
 *   npx tsx server/database/fix-lessons.ts --da=2026-01-01 --apply → APPLICA solo dalla data indicata
 *   (--apply senza --da viene rifiutato: per tutta la storia usare es. --da=2000-01-01)
 */
import 'dotenv/config'
import { ricalcolaTipiECompensiLezioni } from '../services/lesson.service'

const APPLY = process.argv.includes('--apply')

// --da=AAAA-MM-GG → limita il ricalcolo alle lezioni con data >= a quella indicata
const argDa = process.argv.find(a => a.startsWith('--da='))
const DA_DATA = argDa ? argDa.slice('--da='.length) : undefined
if (DA_DATA && !/^\d{4}-\d{2}-\d{2}$/.test(DA_DATA)) {
  console.error(`❌ Data non valida: "${DA_DATA}". Usa il formato --da=AAAA-MM-GG (es. --da=2026-01-01).`)
  process.exit(1)
}

// Rete di sicurezza: scrivere senza perimetro riscriverebbe anche i mesi già liquidati
// con le tariffe di oggi. Chi vuole davvero tutta la storia lo dice esplicitamente.
if (APPLY && !DA_DATA) {
  console.error('❌ Per applicare le correzioni serve un perimetro: --da=AAAA-MM-GG (protegge i mesi già liquidati).')
  console.error('   Se vuoi davvero ricalcolare tutta la storia, indica una data molto vecchia, es. --da=2000-01-01.')
  process.exit(1)
}

async function main() {
  console.log('⚠️  ATTENZIONE: ricalcola tipo e compenso con le TARIFFE ATTUALI, anche per mesi già liquidati.')
  console.log('   Se hai cambiato le tariffe, usa --da=AAAA-MM-GG per limitare il ricalcolo alle lezioni recenti.\n')

  console.log(APPLY ? '🛠️  APPLICAZIONE correzioni…' : '🔍 SIMULAZIONE (nessuna modifica al DB)…')
  console.log(DA_DATA ? `   Perimetro: solo lezioni dal ${DA_DATA} in poi.\n` : '   Perimetro: TUTTE le lezioni (nessun --da indicato).\n')

  const report = await ricalcolaTipiECompensiLezioni(APPLY, DA_DATA)

  const perimetro = report.daData ? `dal ${report.daData} in poi` : 'tutta la storia'

  if (report.daCorreggere === 0) {
    console.log(`✅ Tutto a posto: ${report.totaleLezioni} lezioni considerate (${perimetro}), nessuna da correggere.`)
    process.exit(0)
  }

  console.log(`Lezioni considerate:   ${report.totaleLezioni}  (${perimetro})`)
  console.log(`Lezioni da correggere: ${report.daCorreggere}\n`)

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
  console.log(`Lezioni considerate: ${report.totaleLezioni} (${perimetro}) — da correggere: ${report.daCorreggere}`)

  if (APPLY) {
    console.log('\n✅ Correzioni applicate al database.')
  } else {
    console.log('\nℹ️  Questa era solo una simulazione. Per applicare davvero:')
    console.log(`   npx tsx server/database/fix-lessons.ts${DA_DATA ? ` --da=${DA_DATA}` : ''} --apply`)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Errore durante il ricalcolo:', err)
  process.exit(1)
})
