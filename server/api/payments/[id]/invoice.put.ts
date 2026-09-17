import { UpdateInvoiceStatusSchema } from '#shared/schemas/payment.schema'
import { toggleInvoiceStatus } from '../../../services/payment.service'

// PUT /api/payments/:id/invoice
// Segna una fattura come emessa o non emessa.
// Aggiorna accounting_entries.fatturaEmessa (NON la tabella payments).
// Dopo questa chiamata, il pagamento sparirà o apparirà nella lista "Fatture da emettere".
//
// Body: { "fatturaEmessa": true|false } e/o { "richiedeFattura": true|false }
export default defineEventHandler(async (event) => {
  const paymentId = getRouterParam(event, 'id')

  if (!paymentId) {
    throw createError({ statusCode: 400, statusMessage: 'ID pagamento mancante' })
  }

  const body = await readBody(event)
  const parsed = UpdateInvoiceStatusSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati aggiornamento fattura non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const esito = await toggleInvoiceStatus(paymentId, parsed.data)

  if (!esito) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Movimento contabile non trovato per questo pagamento',
    })
  }

  // bollo: cosa è successo alla marca da bollo (CREATO / RIMOSSO / GIA_VERSATO / null)
  return { data: esito.movimento, bollo: esito.bollo }
})
