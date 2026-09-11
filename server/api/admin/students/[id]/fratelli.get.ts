import { fratelliDi } from '../../../../services/genitori.service'
import { toHttpError } from '../../../../utils/http-error'

// GET /api/admin/students/:id/fratelli
// Gli altri alunni che hanno un genitore in comune con questo ({ fratelli }).
// Dedotto, non memorizzato: stesso account del portale, oppure stesso codice
// fiscale, email o telefono di un genitore. Per ogni legame dice in quale posto
// (primo/secondo) sta quel genitore sulle due schede.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  try {
    return { fratelli: await fratelliDi(studentId) }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
