import { z } from 'zod'
import { updateAccountingEntry } from '../../../services/accounting.service'
import { toHttpError } from '../../../utils/http-error'

const bodySchema = z.object({
  tipo:            z.enum(['ENTRATA', 'USCITA', 'NOTA', 'CREDITO', 'DEBITO']).optional(),
  importo:         z.number().positive().optional(),
  descrizione:     z.string().min(1).optional(),
  categoria:       z.string().nullable().optional(),
  metodoPagamento: z.enum(['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']).nullable().optional(),
  data:            z.string().optional(),
  fatturaEmessa:   z.boolean().optional(),
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
  try {
    return await updateAccountingEntry(id, parsed.data)
  } catch (err: any) {
    const code = err.message?.includes('non trovato') ? 404 : err.message?.includes('automatico') ? 403 : 400
    throw toHttpError(err, code)
  }
})
