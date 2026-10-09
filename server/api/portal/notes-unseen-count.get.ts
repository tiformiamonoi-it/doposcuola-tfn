import { getUnseenNotesCount } from '../../services/portal.service'
import { contaComunicazioniNonLette } from '../../services/comunicazioni.service'
import { getLinkedStudentIds } from '../../utils/portal'

// GET /api/portal/notes-unseen-count — badge "comunicazioni non lette" nella nav famiglia:
// note sui figli + avvisi della segreteria a tutte le famiglie.
// Solo GENITORE: gli account STUDENTE non vedono le note.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') return { count: 0 }

  const ids = await getLinkedStudentIds(user.id)
  const [note, comunicazioni] = await Promise.all([
    getUnseenNotesCount(user.id, ids),
    contaComunicazioniNonLette(user.id),
  ])
  return { count: note + comunicazioni }
})
