import { db } from '../../../../database/client'
import { bookings, bookingSubjects } from '../../../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID mancante' })

  // Delete booking subjects first (cascade might be missing)
  await db.delete(bookingSubjects).where(eq(bookingSubjects.bookingId, id))

  // Delete booking
  await db.delete(bookings).where(eq(bookings.id, id))

  return { success: true }
})
