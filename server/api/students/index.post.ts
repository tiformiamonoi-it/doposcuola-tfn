import { CreateStudentSchema } from '../../../shared/schemas/student.schema'
import { createStudent } from '../../services/student.service'

// POST /api/students
// Crea un nuovo studente dopo validazione Zod
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role === 'TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'I Tutor non possono creare nuovi studenti' })
  }

  const body = await readBody(event)
  const parsed = CreateStudentSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati studente non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const student = await createStudent(parsed.data)

  setResponseStatus(event, 201)
  return { data: student }
})
