import { anonymizeStudent } from '../../../services/gdpr.service'
import { toHttpError } from '../../../utils/http-error'

// POST /api/students/:id/anonymize
// Diritto alla cancellazione (art. 17 GDPR): irreversibile → solo ADMIN.
// Svuota i dati identificativi; contabilità e pagamenti restano (obbligo fiscale).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Operazione riservata all\'amministratore' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  try {
    const esito = await anonymizeStudent(id)
    return { ok: true, ...esito }
  } catch (err: any) {
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
