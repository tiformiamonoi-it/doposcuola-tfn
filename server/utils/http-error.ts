// Converte gli errori dei service in errori HTTP senza far trafilare dettagli interni.
// Convenzione: i service segnalano gli errori "di dominio" con `new Error('messaggio in italiano')`
// e solo quei messaggi arrivano al client. Tutto il resto (errori Postgres, TypeError, bug)
// è un dettaglio interno: viene loggato sul server e il client riceve un 500 generico.
import { createError, H3Error } from 'h3'

// Errore di dominio che porta con sé il codice HTTP: così l'handler non deve
// indovinarlo leggendo il testo, e cambiare un messaggio non cambia il codice.
// Il campo è `status` e non `statusCode` apposta: molti handler fanno
// `if (err.statusCode) throw err` per lasciar passare gli errori h3 già pronti.
export class ErroreDominio extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const nonTrovato = (msg: string) => new ErroreDominio(404, msg)
export const vietato    = (msg: string) => new ErroreDominio(403, msg)
export const conflitto  = (msg: string) => new ErroreDominio(409, msg)

export function toHttpError(err: unknown, statusCode = 400): H3Error {
  if (err instanceof ErroreDominio) {
    return createError({ statusCode: err.status, statusMessage: err.message })
  }
  if (err instanceof H3Error) return err
  // Solo `new Error(...)` puro: le sottoclassi (PostgresError ecc.) non sono messaggi curati
  if (err instanceof Error && err.constructor === Error) {
    return createError({ statusCode, statusMessage: err.message })
  }
  console.error('Errore inatteso:', err)
  return createError({ statusCode: 500, statusMessage: 'Errore interno del server' })
}
