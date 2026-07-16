import { db } from '../../../database/client'
import { accountingEntries } from '../../../database/schema'
import { createProventiDiversi, canSeeProventiDiversi } from '../../../services/accounting.service'
import { conFattura } from '#shared/fattura'
import { z } from 'zod'

const bodySchema = z.object({
  // PROVENTI_DIVERSI non è un tipo reale: crea la coppia ENTRATA/USCITA gemella
  tipo: z.enum(['ENTRATA', 'USCITA', 'CREDITO', 'DEBITO', 'PROVENTI_DIVERSI']),
  importo: z.number().positive(),
  descrizione: z.string().min(1),
  categoria: z.string().optional(),
  metodoPagamento: z.enum(['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']).optional(),
  data: z.string().optional(),
  note: z.string().optional(),
  richiedeFattura: z.boolean().optional(),
  fatturaEmessa: z.boolean().optional(),
  numeroFattura: z.string().optional(),
  dataFattura: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  if (body.tipo === 'PROVENTI_DIVERSI') {
    if (!(await canSeeProventiDiversi(user))) {
      throw createError({ statusCode: 403, statusMessage: 'I proventi diversi sono riservati all\'amministrazione' })
    }
    return await createProventiDiversi({
      importo:         body.importo,
      descrizione:     body.descrizione,
      data:            body.data,
      metodoPagamento: body.metodoPagamento ?? null,
      note:            body.note ?? null,
      richiedeFattura: body.richiedeFattura ?? true,
    })
  }

  if (!body.categoria) {
    throw createError({ statusCode: 400, statusMessage: 'Categoria obbligatoria' })
  }

  const emessa = body.fatturaEmessa ?? false
  const descrizione = (emessa && body.numeroFattura)
    ? conFattura(body.descrizione, body.numeroFattura, body.dataFattura ?? body.data ?? new Date().toISOString().slice(0, 10))
    : body.descrizione

  const [entry] = await db
    .insert(accountingEntries)
    .values({
      tipo: body.tipo,
      importo: body.importo.toFixed(2),
      descrizione,
      categoria: body.categoria,
      metodoPagamento: body.metodoPagamento ?? null,
      data: body.data ? new Date(body.data) : new Date(),
      note: body.note ?? null,
      richiedeFattura: body.richiedeFattura ?? false,
      fatturaEmessa: emessa,
    })
    .returning()

  return entry
})
