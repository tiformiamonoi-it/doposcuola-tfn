import { annullaAssenza } from '../../../services/assenze.service'
import { getPortalStudentIds } from '../../../utils/portal'
import { toHttpError } from '../../../utils/http-error'

// DELETE /api/portal/assenze/[id] — «alla fine viene».
//
// La famiglia può togliere l'avviso finché il giorno non è passato: oggi sì,
// domani sì, ieri no. Un'assenza di ieri è ormai un fatto, e cancellarla
// vorrebbe dire riscrivere la storia di una giornata che c'è già stata.
//
// Il controllo di proprietà è nel servizio: gli alunni ammessi sono quelli
// collegati a chi è entrato, riletti dal database — l'identificativo scritto
// nell'indirizzo non è una prova di niente.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['GENITORE', 'STUDENTE'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato a genitori e studenti' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Assenza non indicata' })

  try {
    return await annullaAssenza(id, {
      studentIdsAmmessi:    await getPortalStudentIds(user),
      soloGiorniNonPassati: true,
    })
  } catch (err: any) {
    throw toHttpError(err, err?.message?.includes('non trovata') ? 404 : 400)
  }
})
