import { z } from 'zod'
import { updateAccountingEntry, canSeeProventiDiversi, isMovimentoProventiDiversi } from '../../../services/accounting.service'
import { CATEGORIE_PROVENTI_DIVERSI } from '#shared/accounting-categories'
import { toHttpError } from '../../../utils/http-error'

const bodySchema = z.object({
  tipo:            z.enum(['ENTRATA', 'USCITA', 'NOTA', 'CREDITO', 'DEBITO']).optional(),
  importo:         z.number().positive().optional(),
  descrizione:     z.string().min(1).optional(),
  categoria:       z.string().nullable().optional(),
  metodoPagamento: z.enum(['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']).nullable().optional(),
  data:            z.string().optional(),
  fatturaEmessa:   z.boolean().optional(),
  richiedeFattura: z.boolean().optional(),
  numeroFattura:   z.string().optional(),
  dataFattura:     z.string().optional(),
})

// PUT /api/accounting/entries/:id
// Modifica consentita SOLO sui movimenti manuali (il service blocca gli automatici).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Riservato agli ADMIN' })
  }
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: parsed.error.format() })
  }

  // Proventi diversi: riservati agli ADMIN in lista. A chi non li vede in elenco
  // il movimento "non esiste" (404); portarci dentro un movimento normale è vietato.
  if (!(await canSeeProventiDiversi(user))) {
    if (await isMovimentoProventiDiversi(id)) {
      throw createError({ statusCode: 404, statusMessage: 'Movimento non trovato' })
    }
    if (parsed.data.categoria && CATEGORIE_PROVENTI_DIVERSI.includes(parsed.data.categoria)) {
      throw createError({ statusCode: 403, statusMessage: 'I proventi diversi sono riservati all\'amministrazione' })
    }
  }

  try {
    return await updateAccountingEntry(id, parsed.data)
  } catch (err: any) {
    throw toHttpError(err)
  }
})
