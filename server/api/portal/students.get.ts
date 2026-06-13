import { getPortalStudents } from '../../services/portal.service'

// GET /api/portal/students
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  // ADMIN/SUPER_TUTOR possono accedere in preview: nessuno studente collegato
  if (user.role !== 'GENITORE') return []

  return await getPortalStudents(user.linkedStudentIds ?? [])
})
