import { deletePayment } from '../../services/payment.service'
import { toHttpError } from '../../utils/http-error'

// DELETE /api/payments/:id
// Elimina un pagamento studente: ripristina il saldo del pacchetto e
// rimuove la scrittura contabile collegata (via cascade).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Riservato ad ADMIN/SUPER_TUTOR' })
  }
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })
  try {
    return await deletePayment(id)
  } catch (err: any) {
    const code = err.message?.includes('non trovato') ? 404 : err.message?.includes('fattura') ? 403 : 400
    throw toHttpError(err, code)
  }
})
