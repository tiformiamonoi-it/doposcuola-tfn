import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

let _db: DrizzleDb | undefined

function createDb(): DrizzleDb {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL non è definita nelle variabili d\'ambiente. Controlla il file .env')
  return drizzle(postgres(url), { schema })
}

// Proxy lazy: si connette solo alla prima query, mai all'avvio del server.
// Questo evita crash all'avvio quando DATABASE_URL non è ancora caricata.
export const db = new Proxy({} as DrizzleDb, {
  get(_, prop: string | symbol) {
    if (!_db) _db = createDb()
    return (_db as Record<string | symbol, unknown>)[prop]
  },
})

export type Db = typeof db
