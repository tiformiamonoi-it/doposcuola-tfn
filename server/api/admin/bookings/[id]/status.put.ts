import { UpdateBookingStatusSchema } from '#shared/schemas/booking.schema'
import { updateBookingStatus } from '../../../../services/booking.service'
import { toHttpError } from '../../../../utils/http-error'

// PUT /api/admin/bookings/:id/status
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID prenotazione mancante' })

  const body = await readBody(event)
  const result = UpdateBookingStatusSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  try {
    return await updateBookingStatus(id, result.data)
  } catch (err: any) {
    if (err.statusCode) throw err
    const code = err.message?.includes('non trovato') ? 404 : 400
    throw toHttpError(err, code)
  }
})
