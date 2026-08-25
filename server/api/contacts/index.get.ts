import { ListContactsQuerySchema } from '#shared/schemas/contact.schema'
import { listContacts } from '../../services/contact.service'
import { toHttpError } from '../../utils/http-error'

// GET /api/contacts
// Lista filtrata e paginata + i numeri delle card, in un'unica risposta
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const parsed = ListContactsQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Parametri di ricerca non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    return await listContacts(parsed.data)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
