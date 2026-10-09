import { ComunicazioneSchema } from '#shared/schemas/comunicazione.schema'
import { inviaComunicazione } from '../../services/comunicazioni.service'
import { toHttpError } from '../../utils/http-error'

// POST /api/comunicazioni — invia DAVVERO a tutte le famiglie (portale + email).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const parsed = ComunicazioneSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Comunicazione non valida',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    setResponseStatus(event, 201)
    return await inviaComunicazione(parsed.data, user.id)
  } catch (err) {
    throw toHttpError(err)
  }
})
