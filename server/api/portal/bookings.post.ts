import { CreateBookingSchema } from '#shared/schemas/booking.schema'
import { createBooking } from '../../services/booking.service'

// POST /api/portal/bookings
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato ai genitori' })
  }

  const body = await readBody(event)
  const result = CreateBookingSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  // Verifica che lo studentId appartenga a questo genitore
  const linkedIds = user.linkedStudentIds ?? []
  if (!linkedIds.includes(result.data.studentId)) {
    throw createError({ statusCode: 403, statusMessage: 'Non puoi prenotare per questo studente' })
  }

  return await createBooking(result.data, user.id)
})
