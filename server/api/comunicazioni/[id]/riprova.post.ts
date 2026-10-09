import { riprovaEmail } from '../../../services/comunicazioni.service'
import { toHttpError } from '../../../utils/http-error'

// POST /api/comunicazioni/:id/riprova — rimanda le email che non erano partite
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID comunicazione mancante' })

  try {
    return await riprovaEmail(id)
  } catch (err) {
    throw toHttpError(err)
  }
})
