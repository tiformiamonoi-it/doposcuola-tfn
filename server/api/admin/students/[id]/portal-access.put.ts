import { z } from 'zod'
import { resetPortalPassword, updatePrenotazioneFlag } from '../../../../services/portal-user.service'

const PutSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reset-password'), userId: z.string().min(1) }),
  z.object({ action: z.literal('toggle-prenotazione'), abilitato: z.boolean() }),
])

// PUT /api/admin/students/:id/portal-access
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  const body = await readBody(event)
  const result = PutSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  try {
    if (result.data.action === 'reset-password') {
      const { tempPassword } = await resetPortalPassword(result.data.userId)
      return { ok: true, tempPassword }
    }

    if (result.data.action === 'toggle-prenotazione') {
      await updatePrenotazioneFlag(studentId, result.data.abilitato)
      return { ok: true }
    }

    throw createError({ statusCode: 400, statusMessage: 'Azione non riconosciuta' })
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: err.message?.includes('non trovato') ? 404 : 400, statusMessage: err.message })
  }
})
