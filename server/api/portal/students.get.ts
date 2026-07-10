import { getPortalStudents } from '../../services/portal.service'
import { getPortalStudentIds } from '../../utils/portal'

// GET /api/portal/students
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  // GENITORE: figli collegati. STUDENTE: sé stesso.
  // ADMIN/SUPER_TUTOR in preview: nessuno studente collegato.
  if (!['GENITORE', 'STUDENTE'].includes(user.role)) return []

  const ids = await getPortalStudentIds(user)
  return await getPortalStudents(ids)
})
