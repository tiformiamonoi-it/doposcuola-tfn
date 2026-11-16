import { ConvenzioneSchema } from '#shared/schemas/convenzione.schema'
import { creaConvenzione } from '../../../services/convenzioni.service'
import { toHttpError } from '../../../utils/http-error'

// POST /api/settings/convenzioni — nuova convenzione. Solo ADMIN.
// La data di creazione la mette il database: è quella che il riepilogo serale annuncia.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN') throw createError({ statusCode: 403, message: 'Forbidden' })

  const parsed = ConvenzioneSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Convenzione non valida', data: { errors: parsed.error.flatten().fieldErrors } })
  }
  try {
    setResponseStatus(event, 201)
    return await creaConvenzione(parsed.data)
  } catch (err) {
    throw toHttpError(err)
  }
})
