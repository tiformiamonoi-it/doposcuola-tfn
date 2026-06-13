import { CreateTutorSchema } from '../../../shared/schemas/tutor.schema'
import { createTutor } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = CreateTutorSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    return createTutor(parsed.data)
  } catch (err: any) {
    if (err.message?.includes('unique') || err.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Email già in uso' })
    }
    throw err
  }
})
