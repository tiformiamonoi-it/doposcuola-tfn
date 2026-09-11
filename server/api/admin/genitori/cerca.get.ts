import { z } from 'zod'
import { cercaGenitori } from '../../../services/genitori.service'
import { toHttpError } from '../../../utils/http-error'

// GET /api/admin/genitori/cerca?q=rossi
// "Collega un genitore già registrato" (C5): cerca fra i genitori già in
// anagrafica e fra gli account del portale, anche partendo dal nome del fratello.
// Restituisce PERSONE ({ persone, altri }), non righe: la stessa mamma registrata
// su due figli compare una volta sola, con tutti e due i figli.
//
// Sotto /api/admin apposta: telefoni, email e codici fiscali dei genitori sono
// dati riservati alla segreteria (/api/students in lettura è aperto anche ai tutor).
const QuerySchema = z.object({
  q: z.string().max(100, 'Testo di ricerca troppo lungo').optional().default(''),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  // Doppia chiusura: la policy di /api/admin lo fa già, ma se un giorno cambiasse
  // questi dati non devono diventare visibili ai tutor per effetto collaterale.
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const parsed = QuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Ricerca non valida' })
  }

  try {
    return await cercaGenitori(parsed.data.q)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
