import { z } from 'zod'
import { getGuadagnoAtteso } from '../../services/analytics.service'

const QuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida'),
  end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida'),
})

// GET /api/accounting/guadagno?start=YYYY-MM-DD&end=YYYY-MM-DD — solo ADMIN
export default defineEventHandler(async (event) => {
  const result = QuerySchema.safeParse(getQuery(event))
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Intervallo date non valido' })
  }
  const { start, end } = result.data
  if (start > end) {
    throw createError({ statusCode: 422, statusMessage: 'La data iniziale è dopo quella finale' })
  }
  // Guardia: massimo ~1 anno per query
  const giorni = (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000
  if (giorni > 366) {
    throw createError({ statusCode: 422, statusMessage: 'Intervallo troppo ampio (max 1 anno)' })
  }

  return await getGuadagnoAtteso(start, end)
})
