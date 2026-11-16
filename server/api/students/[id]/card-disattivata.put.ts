import { z } from 'zod'
import { impostaCardDisattivata } from '../../../services/card.service'
import { toHttpError } from '../../../utils/http-error'
import { MOTIVI_DISATTIVAZIONE_CARD } from '#shared/card-studente'

// PUT /api/students/:id/card-disattivata — "Disattiva card" / "Riattiva card".
// { motivo: 'RICHIESTA_FAMIGLIA' | 'USO_SCORRETTO' } spegne la card; { motivo: null } la riaccende.
// Solo i due motivi del regolamento (art. 5.2): niente testo libero, niente "pagamento in
// ritardo" (a quello pensa già la regola automatica).
// Solo ADMIN/SUPER_TUTOR: è una scrittura sotto /api/students (mutationRoles in auth-policy.ts).
const bodySchema = z.object({
  motivo: z.enum(MOTIVI_DISATTIVAZIONE_CARD).nullable(),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })
  const { motivo } = await readValidatedBody(event, bodySchema.parse)

  try {
    return await impostaCardDisattivata(id, motivo)
  } catch (err) {
    throw toHttpError(err)
  }
})
