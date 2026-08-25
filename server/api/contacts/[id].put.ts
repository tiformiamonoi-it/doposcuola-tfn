import { UpdateContactSchema } from '#shared/schemas/contact.schema'
import { updateContact } from '../../services/contact.service'
import { toHttpError } from '../../utils/http-error'

// PUT /api/contacts/:id
// Modifica parziale: si aggiornano solo i campi effettivamente inviati
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID contatto mancante' })

  const body = await readBody(event)
  const parsed = UpdateContactSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati aggiornamento non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    return { data: await updateContact(id, parsed.data) }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovat') ? 404 : 400)
  }
})
