import { getPortalStudents } from '../../services/portal.service'

// GET /api/portal/students
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato ai genitori' })
  }

  return await getPortalStudents(user.linkedStudentIds ?? [])
})
