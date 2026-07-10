import { z } from 'zod'
import { resetPortalPassword, setStudentAccountActive } from '../../../../services/portal-user.service'

const PutSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reset-password'), userId: z.string().min(1) }),
  z.object({ action: z.literal('toggle-active'), userId: z.string().min(1), active: z.boolean() }),
])

// PUT /api/admin/students/:id/student-account — reset password o attiva/disattiva
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const body = await readBody(event)
  const result = PutSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi' })
  }

  try {
    if (result.data.action === 'reset-password') {
      const { tempPassword, emailInviata } = await resetPortalPassword(result.data.userId)
      return { ok: true, tempPassword, emailInviata }
    }
    return await setStudentAccountActive(result.data.userId, result.data.active)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: err.message?.includes('non trovato') ? 404 : 400, statusMessage: err.message })
  }
})
