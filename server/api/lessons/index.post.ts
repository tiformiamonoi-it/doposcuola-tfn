import { CreateLessonSchema } from '#shared/schemas/lesson.schema'
import { createLesson, verificaPoolOggiPerTutor } from '../../services/lesson.service'
import { tutorPuoModificareOggi } from '../../utils/tutor-time-window'
import { toHttpError } from '../../utils/http-error'
import { sanitizeLessonForTutor } from '../../utils/package-privacy'

// POST /api/lessons
// Crea una nuova lezione con scalamento atomico delle ore dai pacchetti.
// La transazione garantisce: lezione + ore scalate + stati ricalcolati + compenso registrato.
// Restituisce 400 se il pacchetto è CHIUSO, lo slot non esiste, o i dati non sono validi.
//
// Un TUTOR può creare solo proprie lezioni, solo per oggi entro le 20:00, e solo con
// studenti presenti nel "pool" di oggi (prenotazioni del giorno collegate a un'anagrafica reale).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readBody(event)
  const parsed = CreateLessonSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati lezione non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  let input = parsed.data

  if (user.role === 'TUTOR') {
    input = { ...input, tutorId: user.id }

    if (input.forzaGruppo) {
      throw createError({ statusCode: 403, statusMessage: '«Forza Gruppo» può usarlo solo la segreteria' })
    }

    // Il compenso forzato è di ADMIN e SUPER_TUTOR: il tutor non lo scrive
    if (input.compensoForzato != null) {
      throw createError({ statusCode: 403, statusMessage: 'Il compenso forzato può impostarlo solo la segreteria' })
    }

    if (!tutorPuoModificareOggi(input.data)) {
      throw createError({ statusCode: 403, statusMessage: 'Puoi inserire una lezione solo per oggi, fino alle 20:00' })
    }

    const fuoriPool = await verificaPoolOggiPerTutor(input.studenti.map(s => s.studentId))
    if (fuoriPool.length > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: `Studente non presente nel Matching di oggi: ${fuoriPool.join(', ')}`,
      })
    }
  }

  try {
    const lesson = await createLesson(input, user.id)
    setResponseStatus(event, 201)
    return { data: user.role === 'TUTOR' ? sanitizeLessonForTutor(lesson) : lesson }
  } catch (err) {
    throw toHttpError(err)
  }
})
