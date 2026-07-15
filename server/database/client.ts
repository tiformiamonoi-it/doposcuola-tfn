import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

let _db: DrizzleDb | undefined

function createDb(): DrizzleDb {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL non è definita nelle variabili d\'ambiente. Controlla il file .env')

  // Opzioni ottimizzate per ambienti serverless (Vercel) e Connection Pooling (Supabase).
  // IMPORTANTE: max deve stare SOPRA il picco di query parallele di una singola pagina.
  // La pagina Contabilità ne spara ~15 insieme (dashboard ~11 + movimenti + categorie):
  // con max:10 le 5 in eccedenza finivano in coda e, contro il PgBouncer di Supabase
  // (Transaction Mode), la coda si bloccava (connessioni ferme in ClientRead) → pagina
  // appesa fino allo statement_timeout di 2 min. Misurato: max:10 si appende, max:15/20 no.
  // Il PgBouncer gestisce il pool lato server, quindi ogni connessione viene acquisita e
  // rilasciata subito dopo la query — postgres.js le apre solo su richiesta (lazy),
  // quindi max:30 non tiene 30 connessioni aperte: è solo il tetto per i picchi.
  // Le connessioni NON sono per-utente: chi legge/prenota le occupa solo per i ~100ms
  // del caricamento, poi le libera. Il tetto serve al picco = più caricamenti pesanti
  // (Contabilità) nello stesso istante. max:30 copre ~2 Contabilità simultanee.
  // ponytail: 30 basta per 2 admin insieme; se i 5 staff aprissero la Contabilità nello
  //   stesso 100ms il fix vero è ridurre le ~15 query di getDashboard, non alzare max.
  // max: 1 causava deadlock: il browser fa 5-6 chiamate API in parallelo
  // e tutte aspettavano l'unico slot disponibile → timeout infinito (Status: 0).
  return drizzle(postgres(url, {
    ssl: 'require',
    max: 30,           // Sopra il picco (~15) di una pagina, cuscinetto per ~2 pesanti insieme
    prepare: false,    // Necessario per Supabase PgBouncer in Transaction Mode
    fetch_types: false, // Previene i timeout della query di introspezione iniziale
    idle_timeout: 20,   // Chiude le connessioni inattive dopo 20s: evita socket "morti"
                        // quando il pooler Supabase le butta giù dall'altra parte
    max_lifetime: 60 * 15, // Ricicla comunque ogni connessione dopo 15 minuti
    connect_timeout: 10,   // Se non si connette in 10s → errore chiaro, non attesa infinita
  }), { schema })
}

// Proxy lazy: si connette solo alla prima query, mai all'avvio del server.
// Questo evita crash all'avvio quando DATABASE_URL non è ancora caricata.
export const db = new Proxy({} as DrizzleDb, {
  get(_, prop: string | symbol) {
    if (!_db) _db = createDb()
    return (_db as any)[prop]
  },
})

export type Db = typeof db
