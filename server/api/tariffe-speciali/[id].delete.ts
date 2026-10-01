import { deleteTariffaSpeciale } from '../../services/tariffe-speciali.service'
import { toHttpError } from '../../utils/http-error'

// DELETE /api/tariffe-speciali/:id — cancella una regola. Le lezioni già salvate
// tengono il compenso con cui sono state salvate.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })
  try {
    const regola = await deleteTariffaSpeciale(id)
    if (!regola) throw createError({ statusCode: 404, statusMessage: 'Regola non trovata' })
    return { data: regola }
  } catch (err) {
    throw toHttpError(err)
  }
})
