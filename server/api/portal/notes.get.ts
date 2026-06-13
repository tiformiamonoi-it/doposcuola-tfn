import { getPortalNotes } from '../../services/portal.service'

// GET /api/portal/notes
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') return []

  return await getPortalNotes(user.linkedStudentIds ?? [])
})
