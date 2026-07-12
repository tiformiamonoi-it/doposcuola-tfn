import { CreateTimeSlotSchema } from '#shared/schemas/timeslot.schema'
import { createTimeSlot } from '../../../services/timeslot.service'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = CreateTimeSlotSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: { errors: parsed.error.flatten().fieldErrors } })
  }
  try {
    const created = await createTimeSlot(parsed.data)
    setResponseStatus(event, 201)
    return created
  } catch (err: any) {
    if (err.message?.includes('unique') || err.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Esiste già uno slot con questi orari' })
    }
    throw err
  }
})