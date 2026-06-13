import { listBookingsForPortal } from '../../services/booking.service'

// GET /api/portal/bookings
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') return []

  return await listBookingsForPortal(user.id)
})
