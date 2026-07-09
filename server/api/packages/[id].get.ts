import { getPackageById, getPackageRecharges } from '../../services/package.service'
import { isTutorRole, sanitizePackageForTutor } from '../../utils/package-privacy'

// GET /api/packages/:id
// Restituisce un singolo pacchetto con tutti i campi inclusi gli stati attuali
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID pacchetto mancante' })
  }

  const pkg = await getPackageById(id)

  if (!pkg) {
    throw createError({ statusCode: 404, statusMessage: 'Pacchetto non trovato' })
  }

  let recharges: any[] = []
  if (pkg.tipo === 'A_CONSUMO') {
    recharges = await getPackageRecharges(id)
  }

  // I TUTOR non vedono i dati economici degli studenti
  const { user } = await requireUserSession(event)
  if (isTutorRole(user.role)) {
    return { data: sanitizePackageForTutor({ ...pkg, recharges }) }
  }

  return { data: { ...pkg, recharges } }
})
