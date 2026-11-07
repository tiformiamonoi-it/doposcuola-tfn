import { db } from '../../../database/client'
import { systemConfigs } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const configs = await db.select().from(systemConfigs)
  
  // Transform array into an object mapping key -> value
  const result: Record<string, string> = {}
  for (const c of configs) {
    // Le spese fisse sono contabilità riservata: le vede (e le usa, in Impostazioni) solo l'ADMIN
    if (c.key === 'spese_fisse' && user.role !== 'ADMIN') continue
    result[c.key] = c.value
  }
  return result
})
