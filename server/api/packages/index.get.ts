import { PackageQuerySchema } from '../../../shared/schemas/package.schema'
import { listPackages } from '../../services/package.service'
import { isTutorRole, sanitizePackageForTutor } from '../../utils/package-privacy'

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

  const result = await listPackages(parsed.data)

  // I TUTOR non vedono i dati economici degli studenti
  const { user } = await requireUserSession(event)
  if (isTutorRole(user.role)) {
    return { ...result, data: result.data.map(sanitizePackageForTutor) }
  }

  return result
})
