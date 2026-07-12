import { z } from 'zod'
import { CreatePortalAccessSchema } from '#shared/schemas/portal-user.schema'
import { createPortalAccount } from '../../../../services/portal-user.service'
import { toHttpError } from '../../../../utils/http-error'

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

  let input: { studentId: string; email: string; firstName: string; lastName: string }
  if (force) {
    // Solo email necessaria per trovare l'account esistente
    const emailParse = z.object({ email: z.string().email() }).safeParse(body)
    if (!emailParse.success) {
      throw createError({ statusCode: 422, statusMessage: 'Email non valida' })
    }
    input = { studentId, email: emailParse.data.email, firstName: '', lastName: '' }
  } else {
    const result = CreatePortalAccessSchema.safeParse({ ...body, studentId })
    if (!result.success) {
      throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
    }
    input = result.data
  }

  try {
    const outcome = await createPortalAccount(input, force)

    // Caso: email già registrata come GENITORE → richiede conferma dal frontend
    if ('requiresConfirmation' in outcome && outcome.requiresConfirmation) {
      return outcome
    }

    if ('user' in outcome) {
      return {
        ok: true,
        userId: outcome.user.id,
        email: outcome.user.email,
        tempPassword: ('tempPassword' in outcome ? (outcome as any).tempPassword : null) ?? null,
        alreadyExisted: outcome.alreadyExisted,
        emailInviata: ('emailInviata' in outcome ? (outcome as any).emailInviata : false) ?? false,
      }
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    const code = err.message?.includes('non trovato') ? 404 : err.message?.includes('staff') ? 409 : 400
    throw toHttpError(err, code)
  }
})
