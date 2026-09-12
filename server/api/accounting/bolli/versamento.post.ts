import { z } from 'zod'
import { registraVersamentoF24 } from '../../../services/bollo.service'
import { toHttpError } from '../../../utils/http-error'

// POST /api/accounting/bolli/versamento
// Registra il versamento cumulativo dei bolli con l'F24: nasce UNA sola uscita con
// il totale e tutti i bolli ancora aperti vengono chiusi in un colpo solo.
//
// L'importo NON si passa da fuori apposta: è sempre la somma esatta dei bolli che si
// stanno chiudendo. Se si potesse scrivere a mano, basterebbe un refuso per avere
// un'uscita che non corrisponde ai debiti chiusi, e i conti non tornerebbero più.
// L'accesso è già ristretto agli ADMIN da /api/accounting (server/utils/auth-policy.ts).
const bodySchema = z.object({
  data:            z.string().optional(),
  metodoPagamento: z.enum(['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']).default('BONIFICO'),
  note:            z.string().max(500, 'Le note non possono superare 500 caratteri').optional(),
})

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  try {
    return await registraVersamentoF24({
      data:            body.data ? new Date(body.data) : new Date(),
      metodoPagamento: body.metodoPagamento,
      note:            body.note ?? null,
    })
  } catch (err: any) {
    throw toHttpError(err, 400)
  }
})
