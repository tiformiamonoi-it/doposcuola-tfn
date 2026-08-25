/**
 * CHECKUP DEL DATABASE — sola lettura, non modifica nulla.
 *
 * Interroga le statistiche che Postgres (Supabase) tiene da solo su tutte le query
 * eseguite e riporta, in italiano e con i semafori: query lente o troppo frequenti,
 * colonne di collegamento senza indice, indici mai usati, tabelle lette "a tappeto",
 * connessioni aperte.
 *
 * Uso:
 *   npm run checkup:db                 → riepilogo (10 righe per tabella)
 *   npm run checkup:db -- --dettaglio  → elenchi più lunghi (25 righe)
 *
 * Le statistiche sono cumulative dall'ultimo riavvio/reset del database: includono
 * anche le query interne di Supabase (pannello, backup), che qui vengono filtrate.
 */
import 'dotenv/config'
import postgres from 'postgres'

const DETTAGLIO = process.argv.includes('--dettaglio')
const LIMITE = DETTAGLIO ? 25 : 10

// Soglie dei semafori (ms per una singola query; obiettivo di progetto: < 100 ms)
const SOGLIA_GIALLA_MS = 50
const SOGLIA_ROSSA_MS  = 100

const url = process.env.DATABASE_URL
if (!url) {
  console.error('❌ DATABASE_URL non è definita: controlla il file .env')
  process.exit(1)
}

const sql = postgres(url, { ssl: 'require', max: 1, connect_timeout: 20 })

// Query interne di Supabase/pooler/driver: non sono del gestionale
const ESCLUSE = [
  'pg_stat', 'pg_catalog', 'pg_available_extensions', 'pg_timezone_names', 'pg_sleep',
  'pg_backup', 'pg_extension', 'information_schema', '__drizzle', 'pgbouncer.',
  'show transaction_read_only', 'supabase_', 'auth.', 'storage.', 'realtime.', 'net.', 'cron.',
  'pg_roles', 'pg_constraint', 'pg_type', 'pg_namespace', 'pg_class', 'pg_proc', 'pg_attribute',
  'set_config', 'select $1', 'begin', 'commit', 'rollback', 'deallocate',
]

function testoQuery(q: string, max = 95): string {
  const t = q.replace(/\s+/g, ' ').replace(/"/g, '').trim()
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}

function pad(v: unknown, n: number, destra = false): string {
  const s = String(v ?? '')
  return destra ? s.padStart(n) : s.padEnd(n)
}

function semaforo(mediaMs: number): string {
  if (mediaMs >= SOGLIA_ROSSA_MS) return '🔴'
  if (mediaMs >= SOGLIA_GIALLA_MS) return '🟡'
  return '🟢'
}

function titolo(t: string) {
  console.log(`\n${'═'.repeat(78)}\n${t}\n${'═'.repeat(78)}`)
}

type RigaQuery = { calls: string; total_ms: string; mean_ms: string; max_ms: string; rows: string; query: string }

async function main() {
  const avvisi: string[] = []

  // ── 1. Salute generale ──
  const [dim] = await sql`select pg_size_pretty(pg_database_size(current_database())) as dimensione`
  const [cache] = await sql`
    select round(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 1) as pct
    from pg_statio_user_tables where schemaname = 'public'`
  const [reset] = await sql`select stats_reset from pg_stat_database where datname = current_database()`

  titolo('1. SALUTE GENERALE')
  console.log(`Dimensione del database:      ${dim?.dimensione}`)
  const cachePct = Number(cache?.pct ?? 0)
  console.log(`Letture servite dalla memoria: ${cachePct}%  ${cachePct >= 99 ? '🟢' : '🟡 (sotto il 99%: il database legge spesso dal disco)'}`)
  console.log(`Statistiche raccolte da:       ${reset?.stats_reset ? new Date(reset.stats_reset).toLocaleString('it-IT') : "l'avvio del database (mai azzerate)"}`)
  if (cachePct < 99) avvisi.push('Letture dalla memoria sotto il 99%')

  // ── 2. Query dell'app ──
  const [ext] = await sql`select extnamespace::regnamespace::text as schema from pg_extension where extname = 'pg_stat_statements'`
  if (!ext) {
    titolo('2. QUERY')
    console.log("🟡 L'estensione pg_stat_statements non è attiva: nessuna statistica sulle query.")
  } else {
    const vista = `${ext.schema}.pg_stat_statements`
    const filtro = ESCLUSE.map((e) => `lower(s.query) not like '%${e.toLowerCase()}%'`).join(' and ')
    const base = `select s.calls::text, round(s.total_exec_time::numeric)::text as total_ms, round(s.mean_exec_time::numeric, 1)::text as mean_ms, round(s.max_exec_time::numeric)::text as max_ms, s.rows::text, s.query from ${vista} s where ${filtro}`

    const lente     = await sql.unsafe<RigaQuery[]>(`${base} and s.calls >= 5 order by s.mean_exec_time desc limit ${LIMITE}`)
    const pesanti   = await sql.unsafe<RigaQuery[]>(`${base} order by s.total_exec_time desc limit ${LIMITE}`)
    const frequenti = await sql.unsafe<RigaQuery[]>(`${base} order by s.calls desc limit ${LIMITE}`)

    const stampa = (righe: RigaQuery[]) => {
      console.log(`${pad('', 3)}${pad('chiamate', 9, true)}${pad('media ms', 10, true)}${pad('max ms', 8, true)}${pad('totale ms', 11, true)}  query`)
      for (const r of righe) {
        const media = Number(r.mean_ms)
        console.log(`${pad(semaforo(media), 3)}${pad(r.calls, 9, true)}${pad(r.mean_ms, 10, true)}${pad(r.max_ms, 8, true)}${pad(r.total_ms, 11, true)}  ${testoQuery(r.query)}`)
      }
      if (righe.length === 0) console.log('   (nessuna query dell\'app registrata)')
    }

    titolo(`2a. QUERY DELL'APP PIÙ LENTE (media per chiamata, almeno 5 chiamate) — obiettivo < ${SOGLIA_ROSSA_MS} ms`)
    stampa(lente)
    const rosse = lente.filter((r) => Number(r.mean_ms) >= SOGLIA_ROSSA_MS).length
    const gialle = lente.filter((r) => Number(r.mean_ms) >= SOGLIA_GIALLA_MS && Number(r.mean_ms) < SOGLIA_ROSSA_MS).length
    if (rosse) avvisi.push(`${rosse} query con media ≥ ${SOGLIA_ROSSA_MS} ms`)
    if (gialle) avvisi.push(`${gialle} query con media tra ${SOGLIA_GIALLA_MS} e ${SOGLIA_ROSSA_MS} ms`)

    titolo("2b. QUERY DELL'APP CHE COSTANO DI PIÙ IN TOTALE (tempo complessivo)")
    stampa(pesanti)

    titolo("2c. QUERY DELL'APP PIÙ FREQUENTI")
    stampa(frequenti)
  }

  // ── 3. Chiavi esterne senza indice ──
  const fk = await sql`
    select c.conrelid::regclass::text as tabella, a.attname as colonna
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and a.attnum = i.indkey[0])
    order by 1, 2`
  titolo('3. COLONNE DI COLLEGAMENTO (chiavi esterne) SENZA INDICE')
  if (fk.length === 0) console.log('🟢 Nessuna.')
  else {
    console.log(`🟡 ${fk.length} colonne: innocue finché le tabelle sono piccole, sono i primi rallentamenti che compaiono crescendo.`)
    for (const r of fk) console.log(`   • ${r.tabella}.${r.colonna}`)
    avvisi.push(`${fk.length} chiavi esterne senza indice`)
  }

  // ── 4. Indici mai usati (esclusi quelli che servono a garantire unicità) ──
  const inutili = await sql`
    select s.relname as tabella, s.indexrelname as indice, pg_size_pretty(pg_relation_size(s.indexrelid)) as dimensione
    from pg_stat_user_indexes s
    join pg_index i on i.indexrelid = s.indexrelid
    where s.schemaname = 'public' and s.idx_scan = 0 and not i.indisunique and not i.indisprimary
    order by pg_relation_size(s.indexrelid) desc limit ${LIMITE}`
  titolo('4. INDICI MAI USATI (dall\'ultimo azzeramento delle statistiche)')
  if (inutili.length === 0) console.log('🟢 Nessuno.')
  else {
    console.log('🟡 Occupano spazio e rallentano un po\' le scritture senza aiutare le letture. Prima di rimuoverli: le statistiche sono recenti? La funzione che li userebbe è già in uso?')
    for (const r of inutili) console.log(`   • ${r.tabella} → ${r.indice} (${r.dimensione})`)
  }

  // ── 5. Tabelle ──
  const tabelle = await sql`
    select relname as tabella, n_live_tup::text as righe, seq_scan::text, idx_scan::text,
           pg_size_pretty(pg_total_relation_size(relid)) as dimensione
    from pg_stat_user_tables where schemaname = 'public'
    order by n_live_tup desc limit ${LIMITE + 5}`
  titolo('5. TABELLE (righe, letture "a tappeto" vs con indice, spazio)')
  console.log(`${pad('tabella', 24)}${pad('righe', 8, true)}${pad('a tappeto', 11, true)}${pad('con indice', 12, true)}  spazio`)
  for (const r of tabelle) console.log(`${pad(r.tabella, 24)}${pad(r.righe, 8, true)}${pad(r.seq_scan, 11, true)}${pad(r.idx_scan, 12, true)}  ${r.dimensione}`)
  console.log('   Nota: le letture "a tappeto" sono normali sulle tabelle piccole (poche centinaia di righe).')

  // ── 6. Connessioni ──
  const conn = await sql`
    select coalesce(state, 'n/d') as stato, count(*)::int as n
    from pg_stat_activity where datname = current_database() group by state order by n desc`
  titolo('6. CONNESSIONI APERTE ADESSO')
  let attive = 0
  for (const r of conn) {
    if (r.stato === 'active') attive = r.n
    console.log(`   • ${pad(r.stato, 22)} ${r.n}`)
  }
  console.log(`   ${attive > 20 ? '🟡 Molte query in esecuzione contemporanea' : '🟢 Niente code'}`)
  if (attive > 20) avvisi.push(`${attive} connessioni attive contemporaneamente`)

  // ── Verdetto ──
  titolo('VERDETTO')
  if (avvisi.length === 0) console.log('🟢 Tutto in ordine: nessun segnale di lentezza o di problemi strutturali.')
  else {
    console.log('Punti di attenzione (nessuno è un guasto, sono cose da tenere d\'occhio):')
    for (const a of avvisi) console.log(`   • ${a}`)
  }
  console.log(`\nRilancia con --dettaglio per elenchi più lunghi. Stesse informazioni, con i grafici: pannello Supabase → Reports → Query Performance / Database → Advisors.\n`)
}

main()
  .catch((err) => {
    console.error('❌ Checkup non riuscito:', err?.message ?? err)
    process.exitCode = 1
  })
  .finally(() => sql.end())
