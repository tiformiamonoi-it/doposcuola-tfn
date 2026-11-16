import { immagineComunicazione } from '../../../services/comunicazioni.service'
import { rispondiConImmagine } from '../../../utils/immagine-pubblica'

// GET /api/immagini/comunicazioni/<id> — la foto di una comunicazione, PUBBLICA: la chiedono
// le email e il portale. 404 se la comunicazione non c'è, è eliminata o non ha foto:
// eliminandola, la foto sparisce anche dalle email già arrivate (dopo la cache di un'ora).
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  return rispondiConImmagine(event, id ? await immagineComunicazione(id) : null)
})
