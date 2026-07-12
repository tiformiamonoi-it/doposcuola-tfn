import { db } from '../../database/client'
import { systemConfigs } from '../../database/schema'
import { eq } from 'drizzle-orm'

// GET /api/portal/sconti — Convenzioni con le attività partner (cartolibrerie, palestre…)
// mostrate alle famiglie. Configurate dall'admin in Impostazioni → Sconti.
export default defineEventHandler(async () => {
  const [row] = await db
    .select({ value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, 'sconti'))
    .limit(1)

  try {
    const sconti = JSON.parse(row?.value || '[]')
    return Array.isArray(sconti) ? sconti : []
  } catch {
    return []
  }
})
