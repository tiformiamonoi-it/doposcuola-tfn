import { UpdateStudentSchema } from '#shared/schemas/student.schema'
import { getStudentById, updateStudent } from '../../services/student.service'

// PUT /api/students/:id
// Aggiorna parzialmente uno studente (solo i campi inviati)
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role === 'TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'I Tutor non possono modificare gli studenti' })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })
  }

  const existing = await getStudentById(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Studente non trovato' })
  }

  const body = await readBody(event)
  const parsed = UpdateStudentSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati aggiornamento non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const updated = await updateStudent(id, parsed.data)
  return { data: updated }
})
