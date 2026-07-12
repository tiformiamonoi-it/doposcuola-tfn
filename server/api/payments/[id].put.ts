import { UpdatePaymentSchema } from '../../../shared/schemas/payment.schema'
import { updatePayment } from '../../services/payment.service'
import { toHttpError } from '../../utils/http-error'

// PUT /api/payments/:id
// Modifica un pagamento esistente; il movimento contabile collegato viene aggiornato di conseguenza.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Riservato ad ADMIN/SUPER_TUTOR' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })

  const body = await readBody(event)
  const parsed = UpdatePaymentSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati pagamento non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    const payment = await updatePayment(id, parsed.data)
    return { data: payment }
  } catch (err) {
    throw toHttpError(err)
  }
})
