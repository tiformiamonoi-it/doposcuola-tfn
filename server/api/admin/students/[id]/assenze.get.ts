import { riepilogoAssenzeAlunno } from '../../../../services/assenze.service'
import { toHttpError } from '../../../../utils/http-error'

// GET /api/admin/students/:id/assenze
// Le assenze recenti di un alunno, con il conteggio del mese in corso.
//
// Serve a una cosa sola, ed è scritta nel piano (G1): se un ragazzo sparisce per
// tre settimane te ne devi accorgere, anche se nessuna di quelle assenze ha
// scalato un centesimo dal pacchetto. È un termometro, non un conto.
//
// Sotto /api/admin come i consensi, e per la stessa ragione: nel motivo la
// famiglia scrive cose di salute, e /api/students in lettura è aperto ai tutor.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato alla segreteria' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  try {
    return await riepilogoAssenzeAlunno(studentId)
  } catch (err: any) {
    throw toHttpError(err, 400)
  }
})
