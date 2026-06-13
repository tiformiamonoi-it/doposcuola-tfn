import { PayReimbursementSchema } from '../../../../../../shared/schemas/tutor.schema'
import { payReimbursement } from '../../../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const rid    = getRouterParam(event, 'rid')!
  const body   = await readBody(event)
  const parsed = PayReimbursementSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati pagamento non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    return await payReimbursement(rid, parsed.data)
  } catch (err: any) {
    if (err.message === 'Rimborso non trovato') {
      throw createError({ statusCode: 404, statusMessage: 'Rimborso non trovato' })
    }
    throw err
  }
})
