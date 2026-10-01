import { TariffaSpecialeSchema } from '#shared/schemas/tariffe-speciali.schema'
import { createTariffaSpeciale } from '../../services/tariffe-speciali.service'
import { toHttpError } from '../../utils/http-error'

// POST /api/tariffe-speciali — nuova regola. Non tocca le lezioni già salvate.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const parsed = TariffaSpecialeSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: { errors: parsed.error.flatten().fieldErrors } })
  }
  try {
    const regola = await createTariffaSpeciale(parsed.data, user.id)
    setResponseStatus(event, 201)
    return { data: regola }
  } catch (err) {
    throw toHttpError(err)
  }
})
