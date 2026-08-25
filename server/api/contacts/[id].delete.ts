import { archiveContact } from '../../services/contact.service'
import { toHttpError } from '../../utils/http-error'

// DELETE /api/contacts/:id
// Non cancella: archivia (cestino morbido, ripristinabile)
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID contatto mancante' })

  try {
    return { data: await archiveContact(id) }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovat') ? 404 : 400)
  }
})
