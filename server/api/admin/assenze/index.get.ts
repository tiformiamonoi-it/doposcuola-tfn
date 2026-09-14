import { assenzeDelGiorno, assenzeDelPeriodo } from '../../../services/assenze.service'
import { oggiRomeStr } from '../../../utils/tutor-time-window'

// GET /api/admin/assenze?data=AAAA-MM-GG        → chi non viene quel giorno
// GET /api/admin/assenze?da=...&a=...           → tutto un periodo (il mese del calendario)
// Senza parametri: oggi.
//
// PERCHÉ SOTTO /api/admin E NON SOTTO /api/lessons.
// Le assenze non sono lezioni: non hanno tutor, non hanno slot, non scalano ore.
// Ma soprattutto /api/lessons è aperto anche ai TUTOR, e nel motivo di un'assenza
// la famiglia scrive cose come «ha la febbre» o «visita dal dentista»: roba di
// salute, che sta con i Contatti e i Consensi e non con la griglia oraria.
// /api/admin è già riservato ad ADMIN e SUPER_TUTOR dalla policy generale; il
// controllo qui sotto è una seconda chiusura, come per i consensi, perché un
// domani la policy potrebbe cambiare e questi dati non devono aprirsi per sbaglio.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato alla segreteria' })
  }

  const q = getQuery(event)
  const da = typeof q.da === 'string' ? q.da : null
  const a  = typeof q.a  === 'string' ? q.a  : null

  if (da && a) return await assenzeDelPeriodo(da, a)

  const data = typeof q.data === 'string' && q.data ? q.data : oggiRomeStr()
  return await assenzeDelGiorno(data)
})
