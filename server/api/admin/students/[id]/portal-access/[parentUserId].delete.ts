import { unlinkParent } from '../../../../../services/portal-user.service'
import { toHttpError } from '../../../../../utils/http-error'

// DELETE /api/admin/students/:id/portal-access/:parentUserId
// Scollega QUEL genitore da QUELL'alunno. Se il genitore non ha più nessun altro
// figlio collegato, l'account portale viene eliminato; se ha altri figli resta attivo.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  const parentUserId = getRouterParam(event, 'parentUserId')
  if (!parentUserId) throw createError({ statusCode: 400, statusMessage: 'ID genitore mancante' })

  try {
    return await unlinkParent(studentId, parentUserId)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
