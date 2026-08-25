import { DuplicatiQuerySchema } from '#shared/schemas/contact.schema'
import { findDuplicates } from '../../services/contact.service'
import { toHttpError } from '../../utils/http-error'

// GET /api/contacts/duplicati?telefono=&email=
// Avvisa se quel recapito è già in rubrica o appartiene a una famiglia già cliente
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const parsed = DuplicatiQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Parametri di ricerca non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    return await findDuplicates(parsed.data)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
