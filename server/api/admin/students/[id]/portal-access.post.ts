import { z } from 'zod'
import { CreatePortalAccessSchema } from '#shared/schemas/portal-user.schema'
import { createPortalAccount } from '../../../../services/portal-user.service'

// POST /api/admin/students/:id/portal-access
// Con force=true: collega lo studente a un account GENITORE esistente (senza reset password)
// Senza force (o force=false): crea nuovo account o restituisce { requiresConfirmation: true }
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  const body = await readBody(event)
  const force = body.force === true

  if (force) {
    // Solo email necessaria per trovare l'account esistente
    const emailParse = z.object({ email: z.string().email() }).safeParse(body)
    if (!emailParse.success) {
      throw createError({ statusCode: 422, statusMessage: 'Email non valida' })
    }
    const outcome = await createPortalAccount(
      { studentId, email: emailParse.data.email, firstName: '', lastName: '' },
      true,
    )
    return outcome
  }

  const result = CreatePortalAccessSchema.safeParse({ ...body, studentId })
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  const outcome = await createPortalAccount(result.data, false)

  // Caso: email già registrata come GENITORE → richiede conferma dal frontend
  if ('requiresConfirmation' in outcome && outcome.requiresConfirmation) {
    return outcome
  }

  if ('user' in outcome) {
    return {
      ok: true,
      userId: outcome.user.id,
      email: outcome.user.email,
      tempPassword: outcome.tempPassword ?? null,
      alreadyExisted: outcome.alreadyExisted,
    }
  }
})
