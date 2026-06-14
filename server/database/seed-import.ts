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
import { parseDump } from './seed/parse-copy'
import { toArray } from './seed/transforms'

const DRY_RUN = process.argv.includes('--dry-run')

function dumpPath(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  // server/database → risale a radice progetto → .old/old_database.sql
  return resolve(here, '../../.old/old_database.sql')
}

async function main() {
  const sql = readFileSync(dumpPath(), 'utf8')
  const blocks = parseDump(sql)

  console.log('\n=== BLOCCHI COPY TROVATI NEL DUMP ===')
  for (const [table, block] of blocks) {
    console.log(`${String(block.rows.length).padStart(6)}  ${table}`)
  }

  if (DRY_RUN) {
    const pkg = blocks.get('packages')?.rows[0]
    const prof = blocks.get('tutor_profiles')?.rows[0]
    console.log('\n=== CAMPIONE DECODIFICA ARRAY ===')
    console.log('packages.stati  →', toArray(pkg?.stati ?? null))
    console.log('tutor_profiles.materie →', toArray(prof?.materie ?? null))
    console.log('\n[DRY RUN] Nessuna modifica al database.')
    return
  }
  console.log('\n[TODO] Caricamento nel DB — implementato nei task successivi.')
}

main().catch((err) => {
  console.error('\n❌ ERRORE:', err)
  process.exit(1)
})
