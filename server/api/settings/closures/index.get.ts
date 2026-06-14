import { db } from '../../../database/client'
import { closureDates } from '../../../database/schema'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  return await db.select().from(closureDates).orderBy(desc(closureDates.date))
})
