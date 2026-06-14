import { getPackageById, getPackageRecharges } from '../../services/package.service'

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

  return { data: { ...pkg, recharges } }
})
