import { db } from '../../../database/client'
import { systemConfigs } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const configs = await db.select().from(systemConfigs)
  
  // Transform array into an object mapping key -> value
  const result: Record<string, string> = {}
  for (const c of configs) {
    result[c.key] = c.value
  }
  return result
})
