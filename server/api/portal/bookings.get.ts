import { listBookingsForPortalByStudents } from '../../services/booking.service'
import { getPortalStudentIds } from '../../utils/portal'

// GET /api/portal/bookings — prenotazioni degli studenti collegati
// (fatte dal genitore O dallo studente: entrambi vedono le stesse)
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['GENITORE', 'STUDENTE'].includes(user.role)) return []

  const ids = await getPortalStudentIds(user)
  return await listBookingsForPortalByStudents(ids, user.id)
})
