import { CreateReimbursementSchema } from '../../../../shared/schemas/tutor.schema'
import { createReimbursement } from '../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id     = getRouterParam(event, 'id')!
  const body   = await readBody(event)
  const parsed = CreateReimbursementSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati rimborso non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  return createReimbursement(id, parsed.data)
})
