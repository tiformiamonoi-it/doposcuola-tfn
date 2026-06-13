import { getPortalNotes } from '../../services/portal.service'

// GET /api/portal/notes
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato ai genitori' })
  }

  return await getPortalNotes(user.linkedStudentIds ?? [])
})
