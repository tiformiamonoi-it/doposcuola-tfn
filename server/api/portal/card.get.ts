import { getPortalCards } from '../../services/card.service'
import { getPortalStudentIds } from '../../utils/portal'

// GET /api/portal/card — la card studente dei figli (GENITORE) o la propria (STUDENTE).
// ADMIN/SUPER_TUTOR in anteprima: nessuno studente collegato, come /api/portal/students.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['GENITORE', 'STUDENTE'].includes(user.role)) return []

  const ids = await getPortalStudentIds(user)
  return await getPortalCards(ids, user.role === 'STUDENTE')
})
