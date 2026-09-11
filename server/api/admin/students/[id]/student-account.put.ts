import { z } from 'zod'
import { correggiEmailAccount, inviaLinkPassword, setStudentAccountActive } from '../../../../services/portal-user.service'
import { toHttpError } from '../../../../utils/http-error'

const PutSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reset-password'), userId: z.string().min(1) }),
  z.object({ action: z.literal('toggle-active'), userId: z.string().min(1), active: z.boolean() }),
  // Correzione dell'email con cui lo studente entra (e della stessa email in anagrafica)
  z.object({
    action:    z.literal('change-email'),
    userId:    z.string().min(1),
    email:     z.string().trim().email('Email non valida'),
    inviaLink: z.boolean(),
  }),
])

// PUT /api/admin/students/:id/student-account — link "scegli la tua password",
// attiva/disattiva, oppure correggi l'email di accesso
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
    if (result.data.action === 'change-email') {
      // Qui (e solo qui) conta anche l'alunno della URL: correggere l'email vuol
      // dire allineare anche la sua scheda, quindi l'account deve essere proprio
      // il suo. Il controllo vero lo fa il service.
      const studentId = getRouterParam(event, 'id')
      if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })
      return await correggiEmailAccount({
        studentId,
        userId:     result.data.userId,
        nuovaEmail: result.data.email,
        inviaLink:  result.data.inviaLink,
      })
    }
    if (result.data.action === 'reset-password') {
      // motivoEmail/dettaglioEmail valorizzati solo se l'email non è partita
      const { linkPassword, emailInviata, motivoEmail, dettaglioEmail } = await inviaLinkPassword(result.data.userId)
      return { ok: true, linkPassword, emailInviata, motivoEmail, dettaglioEmail }
    }
    return await setStudentAccountActive(result.data.userId, result.data.active)
  } catch (err: any) {
    if (err.statusCode) throw err
    const code = (err.message?.includes('non trovato') || err.message?.includes('non è collegato'))
      ? 404
      : err.message?.includes('già usata') ? 409 : 400
    throw toHttpError(err, code)
  }
})
