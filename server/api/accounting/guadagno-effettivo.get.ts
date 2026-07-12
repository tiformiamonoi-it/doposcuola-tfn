import { z } from 'zod'
import { getGuadagnoEffettivoMese } from '../../services/analytics.service'
import { toHttpError } from '../../utils/http-error'

const QuerySchema = z.object({
  anno: z.coerce.number().int().min(2020).max(2100),
  mese: z.coerce.number().int().min(1).max(12),
})

// GET /api/accounting/guadagno-effettivo?anno=2026&mese=6 — solo ADMIN, solo mesi conclusi
export default defineEventHandler(async (event) => {
  const result = QuerySchema.safeParse(getQuery(event))
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Anno o mese non validi' })
  }

  try {
    return await getGuadagnoEffettivoMese(result.data.anno, result.data.mese)
  } catch (err: any) {
    if (err.message?.includes('non è ancora concluso')) {
      throw toHttpError(err)
    }
    throw err
  }
})
