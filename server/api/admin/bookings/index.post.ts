import { db } from '../../../database/client'
import * as tables from '../../../database/schema'
import { AdminCreateBookingSchema } from '#shared/schemas/booking.schema'
import { valutaMaterieSpeciali } from '../../../services/booking.service'
import { toHttpError } from '../../../utils/http-error'

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

  // Materie speciali: stesse regole del portale (max 1/giorno, fuori data → supplemento €10)
  let supplemento: string | null = null
  try {
    const dateStr = new Date(data.requestedDate).toISOString().split('T')[0]
    supplemento = await valutaMaterieSpeciali(data.subjects ?? [], dateStr!)
  } catch (err: any) {
    throw toHttpError(err)
  }

  const [newBooking] = await db.insert(tables.bookings).values({
    userId: user.id, // L'admin che sta creando la prenotazione o il genitore
    studentId: data.studentId || null,
    studentName: data.studentName,
    studentSurname: data.studentSurname,
    studentPhone: data.studentPhone || '0000000000',
    requestedDate: new Date(data.requestedDate),
    status: data.status,
    notes: data.notes || null,
    supplemento,
  }).returning()

  if (!newBooking) {
    throw createError({ statusCode: 500, statusMessage: 'Creazione prenotazione fallita' })
  }

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
