import { db } from '../../database/client'
import { standardPackages, packages } from '../../database/schema'
import { eq, asc, sql, isNotNull } from 'drizzle-orm'

// GET /api/standard-packages          → template ATTIVI (default: quello che serve alle tendine)
// GET /api/standard-packages?archiviati=1 → template ARCHIVIATI (eliminati con il cestino)
//
// Ogni riga porta con sé `inUso`: quanti pacchetti di studenti sono nati da quel template.
// Serve a non eliminare "alla cieca" un template usato da mezza scuola.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const soloArchiviati = q.archiviati === '1' || q.archiviati === 'true'

  const [lista, uso] = await Promise.all([
    db
      .select()
      .from(standardPackages)
      .where(eq(standardPackages.active, !soloArchiviati))
      .orderBy(asc(standardPackages.categoria), asc(standardPackages.nome)),
    db
      .select({
        templateId: packages.standardPackageId,
        n: sql<number>`count(*)::int`,
      })
      .from(packages)
      .where(isNotNull(packages.standardPackageId))
      .groupBy(packages.standardPackageId),
  ])

  const conteggi = new Map(uso.map((u) => [u.templateId, u.n]))

  return lista.map((t) => ({ ...t, inUso: conteggi.get(t.id) ?? 0 }))
})
