import { UpdateTutorSchema } from '../../../shared/schemas/tutor.schema'
import { updateTutor } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = UpdateTutorSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const result = await updateTutor(id, parsed.data)
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Tutor non trovato' })

  return result
})
