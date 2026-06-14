import { listTutorPayments } from '../../../services/tutor.service'

// GET /api/tutors/:id/payments
// Elenco dei singoli compensi pagati al tutor (con id, per poterli eliminare).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Riservato ad ADMIN/SUPER_TUTOR' })
  }
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })
  return await listTutorPayments(id)
})
