import { getStudentById, deactivateStudent } from '../../services/student.service'

// DELETE /api/students/:id
// Soft-delete: imposta active = false (non cancella il record)
// Lo studente rimane nel DB ma non appare nelle liste attive
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role === 'TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'I Tutor non possono eliminare gli studenti' })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })
  }

  const existing = await getStudentById(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Studente non trovato' })
  }

  if (!existing.active) {
    throw createError({ statusCode: 409, statusMessage: 'Lo studente è già disattivato' })
  }

  const deactivated = await deactivateStudent(id)
  return { data: deactivated }
})
