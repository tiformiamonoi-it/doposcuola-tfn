import { z } from 'zod'
import { inviaLinkPassword, setStudentAccountActive } from '../../../../services/portal-user.service'
import { toHttpError } from '../../../../utils/http-error'

const PutSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reset-password'), userId: z.string().min(1) }),
  z.object({ action: z.literal('toggle-active'), userId: z.string().min(1), active: z.boolean() }),
])

// PUT /api/admin/students/:id/student-account — link "scegli la tua password" o attiva/disattiva
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
      // motivoEmail/dettaglioEmail valorizzati solo se l'email non è partita
      const { linkPassword, emailInviata, motivoEmail, dettaglioEmail } = await inviaLinkPassword(result.data.userId)
      return { ok: true, linkPassword, emailInviata, motivoEmail, dettaglioEmail }
    }
    return await setStudentAccountActive(result.data.userId, result.data.active)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
