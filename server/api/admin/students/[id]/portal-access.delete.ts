import { deletePortalAccount } from '../../../../services/portal-user.service'
import { toHttpError } from '../../../../utils/http-error'

// DELETE /api/admin/students/:id/portal-access
// Elimina l'account GENITORE collegato allo studente (es. creato con email sbagliata).
// Il DB scollega automaticamente tutti gli studenti collegati (FK set null).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  try {
    return await deletePortalAccount(studentId)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
