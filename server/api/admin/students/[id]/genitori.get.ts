import { genitoriDelFratello } from '../../../../services/genitori.service'
import { toHttpError } from '../../../../utils/http-error'

// GET /api/admin/students/:id/genitori
// I genitori di questo alunno ({ fratello, primo, secondo }), nella stessa forma
// della ricerca, pronti da copiare sulla scheda di un fratello: è quello che fa
// il wizard "Nuovo studente" quando riceve `prefill.fratelloId` (voce D2).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  try {
    return await genitoriDelFratello(studentId)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
