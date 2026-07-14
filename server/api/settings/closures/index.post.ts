import { db } from '../../../database/client'
import { closureDates } from '../../../database/schema'
import { z } from 'zod'

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)

  const [created] = await db.insert(closureDates).values({
    date: body.date, // giorno civile 'YYYY-MM-DD', nessuna conversione di fuso
    description: body.description ?? null,
  }).returning()

  return created
})
