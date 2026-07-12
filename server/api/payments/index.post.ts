import { CreatePaymentSchema } from '../../../shared/schemas/payment.schema'
import { createPayment } from '../../services/payment.service'
import { toHttpError } from '../../utils/http-error'

// POST /api/payments
// Registra un pagamento su un pacchetto esistente.
// La transazione garantisce: pagamento + aggiornamento importi pacchetto + stati + movimento contabile.
// Restituisce 400 se il pacchetto è CHIUSO o se il pagamento supera l'importo residuo.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = CreatePaymentSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati pagamento non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    const result = await createPayment(parsed.data)
    setResponseStatus(event, 201)
    return { data: result }
  } catch (err) {
    throw toHttpError(err)
  }
})
