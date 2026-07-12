// Converte gli errori dei service in errori HTTP senza far trafilare dettagli interni.
// Convenzione: i service segnalano gli errori "di dominio" con `new Error('messaggio in italiano')`
// e solo quei messaggi arrivano al client. Tutto il resto (errori Postgres, TypeError, bug)
// è un dettaglio interno: viene loggato sul server e il client riceve un 500 generico.
import { createError, H3Error } from 'h3'

export function toHttpError(err: unknown, statusCode = 400): H3Error {
  if (err instanceof H3Error) return err
  // Solo `new Error(...)` puro: le sottoclassi (PostgresError ecc.) non sono messaggi curati
  if (err instanceof Error && err.constructor === Error) {
    return createError({ statusCode, statusMessage: err.message })
  }
  console.error('Errore inatteso:', err)
  return createError({ statusCode: 500, statusMessage: 'Errore interno del server' })
}
