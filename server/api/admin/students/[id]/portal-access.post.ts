import { CreatePortalAccessSchema } from '#shared/schemas/portal-user.schema'
import { createPortalAccount } from '../../../../services/portal-user.service'

// POST /api/admin/students/:id/portal-access
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  const body = await readBody(event)
  const result = CreatePortalAccessSchema.safeParse({ ...body, studentId })
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  const { user: newUser, tempPassword } = await createPortalAccount(result.data)

  return {
    ok: true,
    userId: newUser.id,
    email: newUser.email,
    tempPassword,
  }
})
