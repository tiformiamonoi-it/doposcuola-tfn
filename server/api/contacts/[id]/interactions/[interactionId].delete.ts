import { deleteInteraction } from '../../../../services/contact.service'
import { toHttpError } from '../../../../utils/http-error'

// DELETE /api/contacts/:id/interactions/:interactionId
// Elimina una riga del diario (errore di battitura). Il service filtra su
// ENTRAMBI gli id: non si può cancellare la riga di un altro contatto.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  const interactionId = getRouterParam(event, 'interactionId')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID contatto mancante' })
  if (!interactionId) throw createError({ statusCode: 400, statusMessage: 'ID interazione mancante' })

  try {
    return await deleteInteraction(id, interactionId)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovat') ? 404 : 400)
  }
})
