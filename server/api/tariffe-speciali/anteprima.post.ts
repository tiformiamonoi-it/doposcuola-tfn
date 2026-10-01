import { AnteprimaCompensoSchema } from '#shared/schemas/tariffe-speciali.schema'
import { anteprimaCompensi } from '../../services/lesson.service'
import { toHttpError } from '../../utils/http-error'

// POST /api/tariffe-speciali/anteprima
// Il compenso che il server salverebbe per una o più lezioni, con la fonte
// ("listino", "tariffa speciale …", "forzato"). Non scrive niente.
// Solo ADMIN e SUPER_TUTOR (vedi auth-policy.ts): il tutor non vede soldi.
export default defineEventHandler(async (event) => {
  const parsed = AnteprimaCompensoSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: { errors: parsed.error.flatten().fieldErrors } })
  }
  try {
    return { data: await anteprimaCompensi(parsed.data) }
  } catch (err) {
    throw toHttpError(err)
  }
})
