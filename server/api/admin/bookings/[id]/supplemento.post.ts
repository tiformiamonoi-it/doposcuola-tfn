import { applicaSupplementoAlPacchetto } from '../../../../services/booking.service'

// POST /api/admin/bookings/:id/supplemento — solo ADMIN/SUPER_TUTOR (policy /api/admin).
// Applica il supplemento della lezione speciale fuori data (+€10) al pacchetto dello
// studente: il pacchetto risulterà "da pagare" per l'importo aggiunto.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'Operazione riservata ad admin e super tutor' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID prenotazione mancante' })

  try {
    return await applicaSupplementoAlPacchetto(id)
  } catch (err: any) {
    throw createError({ statusCode: 400, statusMessage: err.message ?? 'Impossibile applicare il supplemento' })
  }
})
