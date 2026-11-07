import { PackageQuerySchema } from '#shared/schemas/package.schema'
import { listPackages } from '../../services/package.service'
import { isTutorRole, sanitizePackageForTutor, STATI_ECONOMICI } from '../../utils/package-privacy'

// GET /api/packages
// Restituisce i pacchetti con filtri opzionali per studentId, tipo, stati
// Esempio: GET /api/packages?studentId=abc&stati=ATTIVO,DA_PAGARE
export default defineEventHandler(async (event) => {
  const rawQuery = getQuery(event)
  const parsed = PackageQuerySchema.safeParse(rawQuery)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Parametri di ricerca non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  // I TUTOR non vedono i dati economici degli studenti: per loro il filtro
  // "da pagare / pagato" viene ignorato (le righe restituite lo rivelerebbero)
  const { user } = await requireUserSession(event)
  if (isTutorRole(user.role) && parsed.data.stati) {
    parsed.data.stati = parsed.data.stati.split(',').filter(s => !STATI_ECONOMICI.includes(s.trim())).join(',')
  }

  const result = await listPackages(parsed.data)

  if (isTutorRole(user.role)) {
    return { ...result, data: result.data.map(sanitizePackageForTutor) }
  }

  return result
})
