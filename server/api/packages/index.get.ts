import { PackageQuerySchema } from '../../../shared/schemas/package.schema'
import { listPackages } from '../../services/package.service'

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

  return listPackages(parsed.data)
})
