import { ConvenzioneSchema } from '#shared/schemas/convenzione.schema'
import { modificaConvenzione } from '../../../services/convenzioni.service'
import { toHttpError } from '../../../utils/http-error'

// PUT /api/settings/convenzioni/<id> — "Correggi". Solo ADMIN. La data di creazione resta.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN') throw createError({ statusCode: 403, message: 'Forbidden' })

  const parsed = ConvenzioneSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Convenzione non valida', data: { errors: parsed.error.flatten().fieldErrors } })
  }
  try {
    return await modificaConvenzione(getRouterParam(event, 'id') ?? '', parsed.data)
  } catch (err) {
    throw toHttpError(err)
  }
})
