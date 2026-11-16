import { getCardGenitore } from '../../services/card.service'

// GET /api/portal/card-genitore — la card del GENITORE che chiede, e solo la sua: l'id
// viene dalla sessione, quindi l'altro genitore dello stesso ragazzo non si vede mai.
// Lo STUDENTE (e lo staff in anteprima) riceve null: la card del genitore non è sua.
// A parte da /api/portal/card perché quella la legge anche la Home, che resta com'è.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'GENITORE') return null
  return await getCardGenitore(user.id)
})
