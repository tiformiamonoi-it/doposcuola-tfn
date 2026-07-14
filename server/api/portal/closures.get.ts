import { db } from '../../database/client'
import { closureDates } from '../../database/schema'
import { desc, gte } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  // Prendi solo le date di chiusura da oggi in poi (giorno civile italiano)
  const today = oggiRomeStr()

  return await db
    .select()
    .from(closureDates)
    .where(gte(closureDates.date, today))
    .orderBy(desc(closureDates.date))
})
