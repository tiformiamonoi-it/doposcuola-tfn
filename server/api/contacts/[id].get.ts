import { getContact } from '../../services/contact.service'
import { toHttpError } from '../../utils/http-error'

// GET /api/contacts/:id
// Scheda del contatto + diario delle interazioni
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID contatto mancante' })

  try {
    return { data: await getContact(id) }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovat') ? 404 : 400)
  }
})
