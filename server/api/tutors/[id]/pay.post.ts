import { PayTutorSchema } from '../../../../shared/schemas/tutor.schema'
import { payTutor } from '../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id     = getRouterParam(event, 'id')!
  const body   = await readBody(event)
  const parsed = PayTutorSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati liquidazione non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  return payTutor(id, parsed.data)
})
