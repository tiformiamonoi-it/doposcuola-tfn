import { z } from 'zod'
import { createStudentAccount } from '../../../../services/portal-user.service'
import { toHttpError } from '../../../../utils/http-error'

const CreateSchema = z.object({
  email:     z.string().email('Email non valida'),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  // Autorizzazione del genitore: obbligatoria (necessaria per i minori di 14 anni,
  // registrata con timestamp in users.consenso_genitore_at)
  consensoGenitore: z.literal(true, { message: 'Serve l\'autorizzazione del genitore' }),
})

// POST /api/admin/students/:id/student-account — crea l'account personale dello studente
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  const body = await readBody(event)
  const result = CreateSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: result.error.issues[0]?.message ?? 'Dati non validi' })
  }

  try {
    const outcome = await createStudentAccount({ studentId, ...result.data })
    return {
      ok: true,
      userId: outcome.user.id,
      email: outcome.user.email,
      tempPassword: outcome.tempPassword,
      emailInviata: outcome.emailInviata,
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('già usata') ? 409 : 400)
  }
})
