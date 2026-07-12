import { exportStudentData } from '../../../services/gdpr.service'
import { toHttpError } from '../../../utils/http-error'

// GET /api/students/:id/export
// Diritto di accesso/portabilità (artt. 15 e 20 GDPR): JSON scaricabile
// con tutti i dati dello studente, da consegnare alla famiglia che ne fa richiesta.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  try {
    const dati = await exportStudentData(id)
    setHeader(event, 'Content-Disposition', `attachment; filename="dati-studente-${id}.json"`)
    return dati
  } catch (err: any) {
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
