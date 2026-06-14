import { db } from '../../../database/client'
import { accountingEntries } from '../../../database/schema'
import { z } from 'zod'

const bodySchema = z.object({
  tipo: z.enum(['ENTRATA', 'USCITA', 'CREDITO', 'DEBITO']),
  importo: z.number().positive(),
  descrizione: z.string().min(1),
  categoria: z.string(),
  metodoPagamento: z.enum(['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']).optional(),
  data: z.string().optional(),
  note: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)

  const [entry] = await db
    .insert(accountingEntries)
    .values({
      tipo: body.tipo,
      importo: body.importo.toFixed(2),
      descrizione: body.descrizione,
      categoria: body.categoria,
      metodoPagamento: body.metodoPagamento ?? null,
      data: body.data ? new Date(body.data) : new Date(),
      note: body.note ?? null,
    })
    .returning()

  return entry
})
