import { CreateContactSchema } from '#shared/schemas/contact.schema'
import { createContact } from '../../services/contact.service'
import { toHttpError } from '../../utils/http-error'

// POST /api/contacts
// Crea un nuovo contatto (almeno un recapito fra telefono ed email)
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const body = await readBody(event)
  const parsed = CreateContactSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati del contatto non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    const contatto = await createContact(parsed.data, user.id)
    setResponseStatus(event, 201)
    return { data: contatto }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
