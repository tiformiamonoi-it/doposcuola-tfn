import { UpdateLessonSchema } from '../../../shared/schemas/lesson.schema'
import { updateLesson, getLessonById, verificaPoolOggiPerTutor } from '../../services/lesson.service'
import { tutorPuoModificareOggi } from '../../utils/tutor-time-window'

// PUT /api/lessons/:id
// Aggiorna gli studenti/note/forzaGruppo/mezzaLezione di una lezione esistente.
// Un TUTOR può modificare solo le proprie lezioni, solo per la data odierna, entro le 20:00,
// e solo con studenti presenti nel pool di oggi (stessa regola del POST).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID lezione mancante' })

  const body = await readBody(event)
  const parsed = UpdateLessonSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati lezione non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  if (user.role === 'TUTOR') {
    const existing = await getLessonById(id)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Lezione non trovata' })
    if (existing.tutorId !== user.id) {
      throw createError({ statusCode: 403, statusMessage: 'Puoi modificare solo le tue lezioni' })
    }
    if (!tutorPuoModificareOggi(existing.data)) {
      throw createError({ statusCode: 403, statusMessage: 'Puoi modificare una lezione solo lo stesso giorno, fino alle 20:00' })
    }
    if (parsed.data.studenti && parsed.data.studenti.length > 0) {
      const fuoriPool = await verificaPoolOggiPerTutor(parsed.data.studenti.map(s => s.studentId))
      if (fuoriPool.length > 0) {
        throw createError({
          statusCode: 403,
          statusMessage: `Studente non presente nel Matching di oggi: ${fuoriPool.join(', ')}`,
        })
      }
    }
  }

  try {
    const lesson = await updateLesson(id, parsed.data)
    return { data: lesson }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore durante l\'aggiornamento della lezione'
    throw createError({ statusCode: 400, statusMessage: message })
  }
})
