import { CreateLessonSchema } from '../../../shared/schemas/lesson.schema'
import { createLesson } from '../../services/lesson.service'

// POST /api/lessons
// Crea una nuova lezione con scalamento atomico delle ore dai pacchetti.
// La transazione garantisce: lezione + ore scalate + stati ricalcolati + compenso registrato.
// Restituisce 400 se il pacchetto è CHIUSO, lo slot non esiste, o i dati non sono validi.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = CreateLessonSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati lezione non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    const lesson = await createLesson(parsed.data)
    setResponseStatus(event, 201)
    return { data: lesson }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore durante la creazione della lezione'
    throw createError({ statusCode: 400, statusMessage: message })
  }
})
