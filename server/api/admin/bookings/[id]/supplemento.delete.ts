import { annullaSupplementoDalPacchetto } from '../../../../services/booking.service'
import { toHttpError } from '../../../../utils/http-error'

// DELETE /api/admin/bookings/:id/supplemento — solo ADMIN/SUPER_TUTOR (policy /api/admin).
// Toglie dal pacchetto il supplemento approvato per errore: la prenotazione torna
// "da approvare". Rifiuta se la famiglia l'ha già pagato (prima serve un rimborso).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'Operazione riservata ad admin e super tutor' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID prenotazione mancante' })

  try {
    return await annullaSupplementoDalPacchetto(id)
  } catch (err: any) {
    throw toHttpError(err)
  }
})
