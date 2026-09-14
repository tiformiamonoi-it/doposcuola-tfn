import { annullaAssenza } from '../../../services/assenze.service'
import { toHttpError } from '../../../utils/http-error'

// DELETE /api/admin/assenze/[id] — la segreteria toglie un'assenza.
//
// A differenza del portale, qui NON c'è il limite del giorno passato: serve
// proprio a correggere l'errore di tre giorni fa (assenza messa sul fratello
// sbagliato, giorno digitato male). Chi usa il gestionale è la persona che
// risponde di quel dato: non le si mette davanti un cancelletto che poi
// dovrebbe chiedere a qualcun altro di aprire.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato alla segreteria' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Assenza non indicata' })

  try {
    return await annullaAssenza(id)
  } catch (err: any) {
    throw toHttpError(err, err?.message?.includes('non trovata') ? 404 : 400)
  }
})
