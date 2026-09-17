import { rientriDellaFamiglia } from '../../services/confirmation.service'
import { getLinkedStudentIds } from '../../utils/portal'

// GET /api/portal/rientri — la domanda «torna da noi quest'anno?» per ogni figlio.
//
// Solo il GENITORE: il contratto per l'anno nuovo lo decide la famiglia, non il
// ragazzo. Agli altri ruoli (lo STUDENTE, l'admin in anteprima) si risponde vuoto
// invece che con un 403, come fanno già le altre pagine del portale.
// Interruttore spento nella pagina Rientri = nessun figlio, e il riquadro non compare.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') return { anno: '', figli: [] }

  // Gli id si rileggono dal database e non dalla sessione: un figlio collegato
  // dopo l'ultimo accesso deve comparire subito (stessa scelta di students.get).
  return await rientriDellaFamiglia(await getLinkedStudentIds(user.id))
})
