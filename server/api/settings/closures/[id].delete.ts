import { db } from '../../../database/client'
import { closureDates } from '../../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID mancante' })

  const [deleted] = await db.delete(closureDates).where(eq(closureDates.id, id)).returning()
  if (!deleted) throw createError({ statusCode: 404, message: 'Data di chiusura non trovata' })

  return deleted
})
