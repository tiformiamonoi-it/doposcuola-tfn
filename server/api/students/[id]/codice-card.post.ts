import { cambiaCodiceCard } from '../../../services/card.service'
import { toHttpError } from '../../../utils/http-error'

// POST /api/students/:id/codice-card — "Cambia codice" della card studente.
// Solo ADMIN/SUPER_TUTOR: è una scrittura sotto /api/students (mutationRoles in auth-policy.ts).
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  try {
    return await cambiaCodiceCard(id)
  } catch (err) {
    throw toHttpError(err)
  }
})
