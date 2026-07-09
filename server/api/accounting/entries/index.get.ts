import { db } from '../../../database/client'
import { accountingEntries, payments } from '../../../database/schema'
import { and, desc, eq, gte, lte, count, getTableColumns, sql } from 'drizzle-orm'
import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
  tipo: z.enum(['ENTRATA', 'USCITA', 'NOTA', 'CREDITO', 'DEBITO', 'STORNO']).optional(),
  dataInizio: z.string().optional(),
  dataFine: z.string().optional(),
  categoria: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, querySchema.parse)

  const conditions = []
  // "STORNO" non è un tipo reale: gli storni sono movimenti con importo negativo
  if (query.tipo === 'STORNO') {
    conditions.push(sql`${accountingEntries.importo}::numeric < 0`)
  } else if (query.tipo) {
    conditions.push(eq(accountingEntries.tipo, query.tipo))
  }
  if (query.dataInizio) conditions.push(gte(accountingEntries.data, new Date(query.dataInizio)))
  if (query.dataFine) {
    const end = new Date(query.dataFine)
    end.setHours(23, 59, 59, 999)
    conditions.push(lte(accountingEntries.data, end))
  }
  if (query.categoria) conditions.push(eq(accountingEntries.categoria, query.categoria))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  // Left join sui pagamenti: serve richiedeFattura per mostrare l'icona Fattura (E1)
  // solo dove il cliente ha effettivamente richiesto la fattura al momento del pagamento.
  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        ...getTableColumns(accountingEntries),
        richiedeFattura: payments.richiedeFattura,
      })
      .from(accountingEntries)
      .leftJoin(payments, eq(accountingEntries.paymentId, payments.id))
      .where(where)
      .orderBy(desc(accountingEntries.data), desc(accountingEntries.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit),
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
