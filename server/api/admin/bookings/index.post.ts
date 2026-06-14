import { db } from '../../../database/client'
import * as tables from '../../../database/schema'
import { AdminCreateBookingSchema } from '../../../../shared/schemas/booking.schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') throw createError({ statusCode: 403, message: 'Forbidden' })

  const body = await readBody(event)
  const parsed = AdminCreateBookingSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati prenotazione non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const data = parsed.data

  const [newBooking] = await db.insert(tables.bookings).values({
    userId: user.id, // L'admin che sta creando la prenotazione o il genitore
    studentId: data.studentId || null,
    studentName: data.studentName,
    studentSurname: data.studentSurname,
    studentPhone: data.studentPhone || '0000000000',
    requestedDate: new Date(data.requestedDate),
    status: data.status,
    notes: data.notes || null,
  }).returning()

  if (data.subjects && Array.isArray(data.subjects)) {
    const subjectsToInsert = data.subjects.map((s: string) => ({
      bookingId: newBooking.id,
      name: s
    }))
    
    if (subjectsToInsert.length > 0) {
      await db.insert(tables.bookingSubjects).values(subjectsToInsert)
    }
  }

  return newBooking
})
