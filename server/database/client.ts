import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

let _db: DrizzleDb | undefined

function createDb(): DrizzleDb {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL non è definita nelle variabili d\'ambiente. Controlla il file .env')

  // Opzioni ottimizzate per ambienti serverless (Vercel) e Connection Pooling (Supabase).
  // IMPORTANTE: max: 10 permette 10 query parallele senza deadlock.
  // Il PgBouncer di Supabase (Transaction Mode) gestisce il pool lato server,
  // quindi ogni connessione qui viene acquisita e rilasciata istantaneamente
  // dopo ogni singola query — non rischia di saturare il database.
  // max: 1 causava deadlock: il browser fa 5-6 chiamate API in parallelo
  // e tutte aspettavano l'unico slot disponibile → timeout infinito (Status: 0).
  return drizzle(postgres(url, {
    ssl: 'require',
    max: 10,           // Pool sicuro: permette query in parallelo senza deadlock
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
