import { deleteTimeSlot } from '../../../services/timeslot.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })
  try {
    const deleted = await deleteTimeSlot(id)
    if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Slot non trovato' })
    return deleted
  } catch (err: any) {
    throw createError({ statusCode: 400, statusMessage: err.message })
  }
})