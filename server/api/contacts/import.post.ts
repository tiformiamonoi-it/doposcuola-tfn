import { ImportContactsSchema } from '#shared/schemas/contact.schema'
import { importContacts } from '../../services/contact.service'
import { toHttpError } from '../../utils/http-error'

// POST /api/contacts/import
// Riceve le righe di un file CSV già lette dal browser e le inserisce in rubrica,
// saltando i doppioni. Permessi: la regola '/api/contacts' della auth-policy
// (solo ADMIN e SUPER_TUTOR) copre anche questo percorso.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const body = await readBody(event)
  const parsed = ImportContactsSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Righe da importare non valide',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    const esito = await importContacts(parsed.data.righe, parsed.data.tipoDefault, user.id)
    return { data: esito }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
