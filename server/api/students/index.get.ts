import { StudentQuerySchema } from '../../../shared/schemas/student.schema'
import { listStudents } from '../../services/student.service'

// GET /api/students
// Restituisce la lista paginata degli studenti con filtri opzionali
export default defineEventHandler(async (event) => {
  const rawQuery = getQuery(event)
  const parsed = StudentQuerySchema.safeParse(rawQuery)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Parametri di ricerca non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  return listStudents(parsed.data)
})
