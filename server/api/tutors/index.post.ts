import { CreateTutorSchema } from '../../../shared/schemas/tutor.schema'
import { createTutor } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = CreateTutorSchema.safeParse(body)

  if (!parsed.success) {
    console.error('[Tutor Create] Validation Error:', parsed.error.flatten().fieldErrors)
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const { user } = await requireUserSession(event)
  const targetRole = parsed.data.role ?? 'TUTOR'

  // Solo SUPER_TUTOR può creare SUPER_TUTOR. ADMIN può creare solo TUTOR/ADMIN.
  if (targetRole === 'SUPER_TUTOR' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'Solo il Super Admin può creare un Super Admin' })
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
