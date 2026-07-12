import { deleteTutorPayment } from '../../services/tutor.service'
import { toHttpError } from '../../utils/http-error'

// DELETE /api/tutor-payments/:id
// Elimina un compenso tutor; la scrittura contabile collegata sparisce via cascade.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Riservato ad ADMIN/SUPER_TUTOR' })
  }
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })
  try {
    return await deleteTutorPayment(id)
  } catch (err: any) {
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
