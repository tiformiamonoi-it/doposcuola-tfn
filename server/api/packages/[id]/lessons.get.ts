import { getLessonsByPackage } from '../../../services/lesson.service'

// GET /api/packages/:id/lessons
// Storico delle lezioni in cui sono state scalate ore da questo pacchetto.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID pacchetto mancante' })

  return { data: await getLessonsByPackage(id) }
})
