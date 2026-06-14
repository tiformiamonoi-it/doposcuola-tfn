import { getPortalNotes } from '../../services/portal.service'
import { getLinkedStudentIds } from '../../utils/portal'

// GET /api/portal/notes
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') return []

  const ids = await getLinkedStudentIds(user.id)
  return await getPortalNotes(ids)
})
