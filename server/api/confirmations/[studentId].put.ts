import { SetRientroSchema } from '#shared/schemas/confirmation.schema'
import { getAnnoCorrente, setRientro } from '../../services/confirmation.service'
import { toHttpError } from '../../utils/http-error'

// PUT /api/confirmations/:studentId
// Segna la risposta di un alunno per un anno scolastico (crea la riga se manca).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const studentId = getRouterParam(event, 'studentId')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'Alunno mancante' })

  const body = await readBody(event)
  const parsed = SetRientroSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati della risposta non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    // Anno non indicato = quello corrente delle impostazioni
    const anno = parsed.data.anno ?? (await getAnnoCorrente()).anno
    return { data: await setRientro(studentId, anno, parsed.data, user.id) }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovat') ? 404 : 400)
  }
})
