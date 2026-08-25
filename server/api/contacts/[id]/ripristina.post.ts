import { restoreContact } from '../../../services/contact.service'
import { toHttpError } from '../../../utils/http-error'

// POST /api/contacts/:id/ripristina
// Riporta in lista un contatto archiviato
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID contatto mancante' })

  try {
    return { data: await restoreContact(id) }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovat') ? 404 : 400)
  }
})
