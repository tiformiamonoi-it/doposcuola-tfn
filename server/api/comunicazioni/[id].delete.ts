import { eliminaComunicazione } from '../../services/comunicazioni.service'
import { toHttpError } from '../../utils/http-error'

// DELETE /api/comunicazioni/:id — la toglie dai portali (le email partite restano)
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID comunicazione mancante' })

  try {
    return await eliminaComunicazione(id)
  } catch (err) {
    throw toHttpError(err, 404)
  }
})
