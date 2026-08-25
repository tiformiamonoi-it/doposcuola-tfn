import { db } from '../../../database/client'
import { standardPackages } from '../../../database/schema'
import { eq } from 'drizzle-orm'

// POST /api/standard-packages/:id/restore — riporta in elenco un template archiviato
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID mancante' })
  }

  const [updated] = await db
    .update(standardPackages)
    .set({ active: true, updatedAt: new Date() })
    .where(eq(standardPackages.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Template non trovato' })
  }

  return updated
})
