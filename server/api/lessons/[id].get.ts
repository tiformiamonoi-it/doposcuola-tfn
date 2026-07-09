import { getLessonById } from '../../services/lesson.service'

// GET /api/lessons/:id
// Restituisce la lezione con la lista completa degli studenti e le ore scalate.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID lezione mancante' })
  }

  const lesson = await getLessonById(id)

  if (!lesson) {
    throw createError({ statusCode: 404, statusMessage: 'Lezione non trovata' })
  }

  if (user.role === 'TUTOR' && lesson.tutorId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Puoi vedere solo le tue lezioni' })
  }

  return { data: lesson }
})
