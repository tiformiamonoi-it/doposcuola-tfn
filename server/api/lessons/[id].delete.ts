import { deleteLesson, getLessonById } from '../../services/lesson.service'
import { tutorPuoModificareOggi } from '../../utils/tutor-time-window'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID mancante' })

  if (user.role === 'TUTOR') {
    const existing = await getLessonById(id)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Lezione non trovata' })
    if (existing.tutorId !== user.id) {
      throw createError({ statusCode: 403, statusMessage: 'Puoi eliminare solo le tue lezioni' })
    }
    if (!tutorPuoModificareOggi(existing.data)) {
      throw createError({ statusCode: 403, statusMessage: 'Puoi eliminare una lezione solo lo stesso giorno, fino alle 20:00' })
    }
  } else if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  try {
    await deleteLesson(id)
    return { success: true }
  } catch (err: any) {
    throw createError({
      statusCode: 400,
      statusMessage: err.message || 'Errore durante l\'eliminazione della lezione'
    })
  }
})
