import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const env = readFileSync('.env', 'utf8')
const url = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1]
const sql = postgres(url, { ssl: 'require', max: 1, prepare: false, fetch_types: false })

// Scollega lo studente e cancella SOLO l'utente di test appena creato
await sql`UPDATE students SET portal_user_id = NULL WHERE id = 'cmqi4mbmd0001zvz6u46he76l' AND portal_user_id = 'q03glpinpmpg56trw9gxgkf3'`
const del = await sql`DELETE FROM users WHERE id = 'q03glpinpmpg56trw9gxgkf3' AND email = 'test.debug.claude@example.com' RETURNING id`
console.log('utente test cancellato:', del.length)

// Esiste qualche utente GENITORE e qualche email "strana" (maiuscole/spazi)?
const gen = await sql`SELECT email FROM users WHERE role = 'GENITORE' LIMIT 3`
console.log('genitori esistenti:', gen.map(g => g.email))
const weird = await sql`SELECT email FROM users WHERE email != lower(trim(email)) LIMIT 5`
console.log('email non normalizzate:', weird.map(w => w.email))

await sql.end()
