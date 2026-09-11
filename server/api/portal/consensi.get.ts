import { statoConsensiFamiglia } from '../../services/consensi.service'
import { getPortalStudentIds } from '../../utils/portal'

// GET /api/portal/consensi — gli interruttori della privacy come li vede la famiglia.
//
// Solo il GENITORE: la dichiarazione per il minore, la liberatoria delle immagini
// e le comunicazioni promozionali le dà chi ha la responsabilità genitoriale.
// Lo STUDENTE, anche maggiore di 14 anni, non le vede nemmeno: il suo account
// serve a prenotare, e per le foto di un minore decide il genitore fino ai 18.
// Agli altri ruoli (admin in anteprima) si risponde vuoto invece che con un 403,
// come fanno già le altre pagine del portale.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    return { figli: [], marketing: { tipo: 'MARKETING', valore: null, quando: null, origine: null, versione: null } }
  }

  // Gli id si rileggono dal database e non dalla sessione: un figlio collegato
  // dopo l'ultimo accesso deve comparire subito (stessa scelta di students.get).
  const ids = await getPortalStudentIds(user)
  return await statoConsensiFamiglia(user.id, ids)
})
