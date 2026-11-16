import { cambiaCodiceCardGenitore } from '../../../services/card.service'
import { toHttpError } from '../../../utils/http-error'

// POST /api/tutors/:id/cambia-codice-card — "Cambia codice" della card del tutor (card
// persa o girata ad altri): il vecchio codice e il suo QR smettono subito di valere.
// Solo ADMIN/SUPER_TUTOR (già imposto da API_POLICY su /api/tutors) e solo su un account
// TUTOR: SUPER_TUTOR e ADMIN non hanno card (404).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID tutor mancante' })
  try {
    return await cambiaCodiceCardGenitore(id, 'TUTOR')
  } catch (err) {
    throw toHttpError(err)
  }
})
