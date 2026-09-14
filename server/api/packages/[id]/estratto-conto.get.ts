import { getEstrattoContoLibretto } from '../../../services/package.service'
import { toHttpError } from '../../../utils/http-error'

// GET /api/packages/:id/estratto-conto
// L'estratto conto delle ore del libretto (pacchetto A CONSUMO): ricariche e lezioni
// in un elenco unico, in ordine di data, con il saldo dopo ogni riga.
//
// Ruolo ADMIN/SUPER_TUTOR come le altre rotte economiche dei pacchetti (ricarica,
// modifica avanzata): qui dentro ci sono gli importi pagati, che ai TUTOR non si
// mostrano nemmeno in lettura.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID pacchetto mancante' })

  try {
    return { data: await getEstrattoContoLibretto(id) }
  } catch (err: any) {
    // "Pacchetto non trovato" e "non è un libretto" sono messaggi curati per la
    // segreteria: toHttpError li lascia passare così come sono.
    throw toHttpError(err)
  }
})
