// Riproduzione bug portal-access 500 — SOLO LETTURE + transazione con ROLLBACK
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const env = readFileSync('.env', 'utf8')
const url = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1]
const sql = postgres(url, { ssl: 'require', max: 1, prepare: false, fetch_types: false })

const studentId = 'cmqi4mbmd0001zvz6u46he76l'

try {
  const [stu] = await sql`SELECT id, first_name, last_name, parent_email, portal_user_id FROM students WHERE id = ${studentId}`
  console.log('studente:', stu)

  // Simula la transazione del service (poi ROLLBACK)
  await sql.begin(async (tx) => {
    const [u] = await tx`
      INSERT INTO users (id, email, password, first_name, last_name, role, active)
      VALUES ('test_repro_id_123', 'test-repro@example.com', 'x', 'Test', 'Repro', 'GENITORE', true)
      RETURNING id, email`
    console.log('insert utente OK:', u)
    await tx`UPDATE students SET portal_user_id = ${u.id}, updated_at = now() WHERE id = ${studentId}`
    console.log('update studente OK')
    throw new Error('ROLLBACK_VOLUTO')
  }).catch(e => {
    if (e.message === 'ROLLBACK_VOLUTO') console.log('rollback eseguito, nessun dato salvato')
    else throw e
  })
} catch (err) {
  console.error('ERRORE REALE:', err.constructor.name, '-', err.message, err.code ?? '', err.column_name ?? '', err.constraint_name ?? '', err.detail ?? '')
} finally {
  await sql.end()
}
