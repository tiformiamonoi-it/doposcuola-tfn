import { ComunicazioneSchema } from '#shared/schemas/comunicazione.schema'
import { inviaProva } from '../../services/comunicazioni.service'
import { toHttpError } from '../../utils/http-error'

// POST /api/comunicazioni/prova — "Invia una prova a me".
// Parte UNA email, all'indirizzo di chi la sta scrivendo, e non si salva niente:
// serve a vedere com'è prima di mandarla a tutti (il gestionale di prova usa la
// posta vera e il database vero).
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
    return await inviaProva(parsed.data, user.id)
  } catch (err) {
    throw toHttpError(err)
  }
})
