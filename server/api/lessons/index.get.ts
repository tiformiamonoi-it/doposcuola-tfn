import { LessonQuerySchema } from '../../../shared/schemas/lesson.schema'
import { listLessons } from '../../services/lesson.service'

// GET /api/lessons
// Lista paginata di lezioni con filtri opzionali.
// Esempi:
//   GET /api/lessons?tutorId=abc&dataInizio=2026-06-01&dataFine=2026-06-30
//   GET /api/lessons?studentId=xyz&tipo=GRUPPO&page=2
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const rawQuery = getQuery(event)
  const parsed = LessonQuerySchema.safeParse(rawQuery)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Parametri di ricerca non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  // Un TUTOR vede solo le proprie lezioni: il filtro è imposto lato server,
  // non basta nasconderlo nel frontend.
  const query = user.role === 'TUTOR'
    ? { ...parsed.data, tutorId: user.id }
    : parsed.data

  return listLessons(query)
})
