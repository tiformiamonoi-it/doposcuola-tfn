import { getSupplementiPacchetto } from '../../../services/booking.service'

// GET /api/packages/:id/supplementi — supplementi materie speciali applicati al pacchetto.
// Sono soldi: solo ADMIN/SUPER_TUTOR (la policy /api/packages lascerebbe leggere lo STAFF).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso non consentito per il tuo ruolo' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })

  return { data: await getSupplementiPacchetto(id) }
})
