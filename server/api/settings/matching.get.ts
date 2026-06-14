import { db } from '../../database/client'
import { systemConfigs } from '../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  
  const config = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, 'daily_matching_state')
  })
  
  if (!config) return { matching: [] }
  
  try {
    return { matching: JSON.parse(config.value) }
  } catch (err) {
    return { matching: [] }
  }
})
