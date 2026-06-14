import { getPortalStudents } from '../../services/portal.service'
import { getLinkedStudentIds } from '../../utils/portal'

// GET /api/portal/students
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  // ADMIN/SUPER_TUTOR possono accedere in preview: nessuno studente collegato
  if (user.role !== 'GENITORE') return []

  const ids = await getLinkedStudentIds(user.id)
  return await getPortalStudents(ids)
})
