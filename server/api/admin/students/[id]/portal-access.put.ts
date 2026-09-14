import { z } from 'zod'
import { updatePrenotazioneFlag, updateRiepilogoSeraleFlag } from '../../../../services/portal-user.service'
import { toHttpError } from '../../../../utils/http-error'

// Solo azioni che riguardano l'alunno nel suo insieme: le azioni su un singolo
// genitore (reset password, scollegamento) stanno in portal-access/[parentUserId].*
const PutSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('toggle-prenotazione'), abilitato: z.boolean() }),
  // L'email serale "c'è una comunicazione nuova nel portale" per questa famiglia.
  // È un comando della segreteria, non della famiglia: qui infatti servono ADMIN o
  // SUPER_TUTOR, esattamente come per la prenotazione online.
  z.object({ action: z.literal('toggle-riepilogo-serale'), attivo: z.boolean() }),
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
    if (result.data.action === 'toggle-prenotazione') {
      await updatePrenotazioneFlag(studentId, result.data.abilitato)
      return { ok: true }
    }

    if (result.data.action === 'toggle-riepilogo-serale') {
      await updateRiepilogoSeraleFlag(studentId, result.data.attivo)
      return { ok: true }
    }

    throw createError({ statusCode: 400, statusMessage: 'Azione non riconosciuta' })
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
