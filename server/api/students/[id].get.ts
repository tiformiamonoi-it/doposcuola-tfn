import { getStudentById } from '../../services/student.service'

// GET /api/students/:id
// Restituisce un singolo studente o 404 se non esiste
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })
  }

  const student = await getStudentById(id)

  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Studente non trovato' })
  }

  return student
})
