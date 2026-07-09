import { deleteReimbursement } from '../../../../services/tutor.service'

// DELETE /api/tutors/:id/reimbursements/:rid
// Elimina un rimborso intero; tutte le scritture contabili collegate spariscono via cascade.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Riservato ad ADMIN/SUPER_TUTOR' })
  }
  const rid = getRouterParam(event, 'rid')
  if (!rid) throw createError({ statusCode: 400, statusMessage: 'ID rimborso mancante' })
  try {
    return await deleteReimbursement(rid)
  } catch (err: any) {
    throw createError({ statusCode: err.message?.includes('non trovato') ? 404 : 400, statusMessage: err.message })
  }
})
