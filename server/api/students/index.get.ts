import { StudentQuerySchema } from '#shared/schemas/student.schema'
import { listStudents } from '../../services/student.service'
import { isTutorRole } from '../../utils/package-privacy'
import { sanitizeStudentForTutor } from '../../utils/student-privacy'

// GET /api/students
// Restituisce la lista paginata degli studenti con filtri opzionali
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const rawQuery = getQuery(event)
  const parsed = StudentQuerySchema.safeParse(rawQuery)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Parametri di ricerca non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  // Il TUTOR non cerca per email del genitore e non vede lo stato dei pagamenti
  const result = await listStudents(parsed.data, { perTutor: isTutorRole(user.role) })

  // I TUTOR non vedono recapiti/dati fiscali dei genitori
  if (isTutorRole(user.role)) {
    result.data = result.data.map(sanitizeStudentForTutor)
  }

  return result
})
