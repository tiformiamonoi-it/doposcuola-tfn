import { deletePackage } from '../../services/package.service'
import { toHttpError } from '../../utils/http-error'

// DELETE /api/packages/:id
// Consentito solo se il pacchetto non ha pagamenti né lezioni collegate.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Riservato ad ADMIN/SUPER_TUTOR' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID pacchetto mancante' })

  try {
    return await deletePackage(id)
  } catch (err: any) {
    const code = err.message?.includes('non trovato') ? 404 : err.message?.includes('collegate') ? 409 : 400
    throw toHttpError(err, code)
  }
})
