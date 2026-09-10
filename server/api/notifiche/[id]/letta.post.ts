import { segnaLetta } from '../../../services/notifiche.service'
import { toHttpError } from '../../../utils/http-error'

// POST /api/notifiche/:id/letta — segna UNA notifica come letta.
// La lettura è di squadra: da qui in poi risulta letta a tutta la segreteria
// (vedi il commento sulla tabella `notifiche` in server/database/schema/system.ts).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID notifica mancante' })

  try {
    return await segnaLetta(id, user.id)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
