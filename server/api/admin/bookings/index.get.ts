import { listBookingsForAdmin } from '../../../services/booking.service'

// GET /api/admin/bookings?studentId=...
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const query = getQuery(event)
  const studentId = typeof query.studentId === 'string' ? query.studentId : undefined

  return await listBookingsForAdmin(studentId)
})
