import { z } from 'zod'
import { createStudentAccount } from '../../../../services/portal-user.service'
import { toHttpError } from '../../../../utils/http-error'

const CreateSchema = z.object({
  email:     z.string().email('Email non valida'),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  // Autorizzazione del genitore: un booleano normale, non più un "deve essere true".
  // NON è diventata facoltativa per tutti — è diventata obbligatoria per chi
  // davvero la richiede: il blocco vero sta nel servizio, che legge la data di
  // nascita dal database e rifiuta la creazione solo per gli alunni sotto i 14
  // anni (decisione Q16). Qui pretendere z.literal(true) rimetterebbe in piedi la
  // richiesta sbagliata — la spunta per un sedicenne — e lo farebbe di nascosto.
  // Quando c'è viene registrata con data, ora e operatore in
  // users.consenso_genitore_at / users.consenso_genitore_registrato_da_user_id.
  consensoGenitore: z.boolean().optional().default(false),
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
    // L'operatore del consenso è chi ha la sessione aperta ADESSO, mai un id
    // arrivato dal browser: così nessuno può firmare un consenso a nome di un altro.
    const outcome = await createStudentAccount({
      studentId,
      ...result.data,
      registratoDaUserId: user.id,
    })
    return {
      ok: true,
      userId: outcome.user.id,
      email: outcome.user.email,
      linkPassword: outcome.linkPassword,
      emailInviata: outcome.emailInviata,
      // Valorizzati solo quando l'email non è partita: dicono il motivo vero
      motivoEmail: outcome.motivoEmail,
      dettaglioEmail: outcome.dettaglioEmail,
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    if (err.message?.includes('già usata')) throw toHttpError(err, 409)
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
