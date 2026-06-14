import { deleteLesson } from '../../services/lesson.service'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID mancante' })

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
