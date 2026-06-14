import { db } from '../../../database/client'
import { accountingEntries } from '../../../database/schema'
import { and, desc, eq, gte, lte, count } from 'drizzle-orm'
import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
  tipo: z.enum(['ENTRATA', 'USCITA', 'NOTA', 'STORNO']).optional(),
  dataInizio: z.string().optional(),
  dataFine: z.string().optional(),
  categoria: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, querySchema.parse)

  const conditions = []
  if (query.tipo) conditions.push(eq(accountingEntries.tipo, query.tipo))
  if (query.dataInizio) conditions.push(gte(accountingEntries.data, new Date(query.dataInizio)))
  if (query.dataFine) {
    const end = new Date(query.dataFine)
    end.setHours(23, 59, 59, 999)
    conditions.push(lte(accountingEntries.data, end))
  }
  if (query.categoria) conditions.push(eq(accountingEntries.categoria, query.categoria))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [countRow]] = await Promise.all([
    db.query.accountingEntries.findMany({
      where,
      orderBy: [desc(accountingEntries.data), desc(accountingEntries.id)],
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    }),
    db.select({ total: count() }).from(accountingEntries).where(where),
  ])

  return {
    data: rows,
    meta: {
      page: query.page,
      limit: query.limit,
      total: countRow!.total,
      totalPages: Math.ceil(countRow!.total / query.limit),
    },
  }
})
