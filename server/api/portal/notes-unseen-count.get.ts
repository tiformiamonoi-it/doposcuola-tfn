import { getUnseenNotesCount } from '../../services/portal.service'
import { getLinkedStudentIds } from '../../utils/portal'

// GET /api/portal/notes-unseen-count — badge "note non lette" nella nav famiglia.
// Solo GENITORE: gli account STUDENTE non vedono le note.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') return { count: 0 }

  const ids = await getLinkedStudentIds(user.id)
  return { count: await getUnseenNotesCount(user.id, ids) }
})
