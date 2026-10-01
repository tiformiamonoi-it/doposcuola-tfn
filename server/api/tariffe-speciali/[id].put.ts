import { TariffaSpecialeSchema } from '#shared/schemas/tariffe-speciali.schema'
import { updateTariffaSpeciale } from '../../services/tariffe-speciali.service'
import { toHttpError } from '../../utils/http-error'

// PUT /api/tariffe-speciali/:id — modifica una regola. Non tocca le lezioni già salvate.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })
  const parsed = TariffaSpecialeSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: { errors: parsed.error.flatten().fieldErrors } })
  }
  try {
    const regola = await updateTariffaSpeciale(id, parsed.data)
    if (!regola) throw createError({ statusCode: 404, statusMessage: 'Regola non trovata' })
    return { data: regola }
  } catch (err) {
    throw toHttpError(err)
  }
})
