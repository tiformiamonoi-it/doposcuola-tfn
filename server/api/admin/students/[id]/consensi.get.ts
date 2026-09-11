import { statoConsensi, storicoConsensi } from '../../../../services/consensi.service'
import { toHttpError } from '../../../../utils/http-error'

// GET /api/admin/students/:id/consensi
// I consensi privacy di un alunno: `stato` (com'è adesso) e `storico` (tutti i
// cambiamenti, dal più recente). Le due cose viaggiano insieme perché la scheda
// le mostra insieme, e una sola chiamata evita che gli interruttori e lo storico
// raccontino due momenti diversi.
//
// Sotto /api/admin apposta: i consensi privacy sono riservati alla segreteria
// come i Contatti e i Rientri (/api/students in lettura è aperto anche ai tutor).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  // Doppia chiusura: la policy di /api/admin lo fa già, ma se un giorno cambiasse
  // questi dati non devono diventare visibili ai tutor per effetto collaterale.
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  try {
    const [stato, storico] = await Promise.all([
      statoConsensi(studentId),
      storicoConsensi(studentId),
    ])
    return { stato, storico }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
