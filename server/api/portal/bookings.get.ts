import { listBookingsForPortal } from '../../services/booking.service'

// GET /api/portal/bookings
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato ai genitori' })
  }

  return await listBookingsForPortal(user.id)
})
