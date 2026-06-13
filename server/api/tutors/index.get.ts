import { TutorQuerySchema } from '../../../shared/schemas/tutor.schema'
import { listTutors } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const rawQuery = getQuery(event)
  const parsed = TutorQuerySchema.safeParse(rawQuery)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Parametri non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  return listTutors(parsed.data)
})
