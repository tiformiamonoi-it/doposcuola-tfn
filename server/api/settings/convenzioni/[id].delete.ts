import { eliminaConvenzione } from '../../../services/convenzioni.service'
import { toHttpError } from '../../../utils/http-error'

// DELETE /api/settings/convenzioni/<id> — toglie la convenzione (e la sua foto). Solo ADMIN.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN') throw createError({ statusCode: 403, message: 'Forbidden' })
  try {
    return await eliminaConvenzione(getRouterParam(event, 'id') ?? '')
  } catch (err) {
    throw toHttpError(err)
  }
})
