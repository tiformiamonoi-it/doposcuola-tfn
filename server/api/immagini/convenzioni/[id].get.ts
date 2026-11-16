import { immagineConvenzione } from '../../../services/convenzioni.service'
import { rispondiConImmagine } from '../../../utils/immagine-pubblica'

// GET /api/immagini/convenzioni/<id> — la foto di una convenzione, PUBBLICA (vedi
// PUBLIC_API_PREFIXES): la mostrano il portale e Impostazioni. 404 se non c'è.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  return rispondiConImmagine(event, id ? await immagineConvenzione(id) : null)
})
