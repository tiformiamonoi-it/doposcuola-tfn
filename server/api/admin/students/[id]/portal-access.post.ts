import { z } from 'zod'
import { CreatePortalAccessSchema } from '#shared/schemas/portal-user.schema'
import { createPortalAccount } from '../../../../services/portal-user.service'
import { toHttpError } from '../../../../utils/http-error'

// POST /api/admin/students/:id/portal-access
// AGGIUNGE un genitore all'alunno (gli altri genitori già collegati non si toccano).
// Con force=true: collega l'alunno a un account GENITORE esistente (senza reset password)
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

  let input: { studentId: string; email: string; firstName: string; lastName: string; relazione?: string }
  if (force) {
    // Solo email necessaria per trovare l'account esistente; l'etichetta resta opzionale
    const emailParse = z.object({
      email:     z.string().email(),
      relazione: z.string().max(50).optional(),
    }).safeParse(body)
    if (!emailParse.success) {
      throw createError({ statusCode: 422, statusMessage: 'Email non valida' })
    }
    input = { studentId, email: emailParse.data.email, firstName: '', lastName: '', relazione: emailParse.data.relazione }
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
        // Link "scegli la tua password" da mostrare/copiare in segreteria.
        // Assente quando l'account esisteva già (alreadyExisted): in quel caso
        // le credenziali del genitore non si toccano.
        linkPassword: ('linkPassword' in outcome ? (outcome as any).linkPassword : null) ?? null,
        alreadyExisted: outcome.alreadyExisted,
        emailInviata: ('emailInviata' in outcome ? (outcome as any).emailInviata : false) ?? false,
        // Se l'email non è partita, il perché: serve alla segreteria per capire
        // se deve solo mandare il link a mano o se la posta è proprio bloccata.
        motivoEmail: 'motivoEmail' in outcome ? outcome.motivoEmail : undefined,
        dettaglioEmail: 'dettaglioEmail' in outcome ? outcome.dettaglioEmail : undefined,
      }
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    const code = err.message?.includes('non trovato')
      ? 404
      : (err.message?.includes('staff') || err.message?.includes('già collegato') || err.message?.includes('già usata'))
          ? 409
          : 400
    throw toHttpError(err, code)
  }
})
