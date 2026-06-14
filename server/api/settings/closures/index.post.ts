import { db } from '../../../database/client'
import { closureDates } from '../../../database/schema'
import { z } from 'zod'

const bodySchema = z.object({
  date: z.string(),
  description: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  
  const [created] = await db.insert(closureDates).values({
    date: new Date(body.date),
    description: body.description ?? null,
  }).returning()

  return created
})
