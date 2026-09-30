import { UpdateTimeSlotSchema } from '#shared/schemas/timeslot.schema'
import { updateTimeSlot, setSlotSempreVisibile } from '../../../services/timeslot.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })
  const body = await readBody(event)
  const parsed = UpdateTimeSlotSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: { errors: parsed.error.flatten().fieldErrors } })
  }
  const updated = await updateTimeSlot(id, parsed.data)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Slot non trovato' })
  // "Sempre visibile nel calendario" vive in system_configs, non nella tabella slot
  if (typeof body?.sempreVisibile === 'boolean') await setSlotSempreVisibile(id, body.sempreVisibile)
  return updated
})