import { getLessonsByPackage } from '../../../services/lesson.service'
import { isTutorRole } from '../../../utils/package-privacy'

// GET /api/packages/:id/lessons
// Storico delle lezioni in cui sono state scalate ore da questo pacchetto.
// Il TUTOR vede solo le proprie lezioni, come su /api/lessons.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID pacchetto mancante' })

  return { data: await getLessonsByPackage(id, isTutorRole(user.role) ? user.id : undefined) }
})
