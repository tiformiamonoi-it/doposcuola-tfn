import { assenzeFamiglia } from '../../services/assenze.service'
import { getPortalStudentIds } from '../../utils/portal'

// GET /api/portal/assenze — i giorni in cui la famiglia ha già avvisato che non viene.
//
// Lo vedono il GENITORE (i figli collegati) e lo STUDENTE (sé stesso): la lista
// è la stessa per tutti e due, come per le prenotazioni. Se il ragazzo delle
// medie avvisa dal suo account, il genitore la vede lo stesso — e viceversa:
// l'avviso è uno solo, non due mezze verità.
//
// Agli altri ruoli (un admin che guarda il portale in anteprima) si risponde
// vuoto invece che con un 403, come già fanno le altre pagine del portale.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['GENITORE', 'STUDENTE'].includes(user.role)) {
    return { oggi: '', prossime: [], passate: [] }
  }

  // Gli id si rileggono dal database e non dalla sessione: un figlio collegato
  // dopo l'ultimo accesso deve comparire subito (stessa scelta di students.get).
  const ids = await getPortalStudentIds(user)
  return await assenzeFamiglia(ids)
})
