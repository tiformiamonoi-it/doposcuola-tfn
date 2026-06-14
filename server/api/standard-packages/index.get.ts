import { db } from '../../database/client'
import { standardPackages } from '../../database/schema'
import { eq, asc } from 'drizzle-orm'

// GET /api/standard-packages — lista tutti i template pacchetti attivi
export default defineEventHandler(async () => {
  const lista = await db
    .select()
    .from(standardPackages)
    .where(eq(standardPackages.active, true))
    .orderBy(asc(standardPackages.categoria), asc(standardPackages.nome))

  return lista
})
