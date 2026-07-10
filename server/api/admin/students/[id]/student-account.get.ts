import { eq } from 'drizzle-orm'
import { db } from '../../../../database/client'
import { students } from '../../../../database/schema'

// GET /api/admin/students/:id/student-account — stato dell'account personale dello studente
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
    columns: { id: true, studentUserId: true, studentEmail: true, firstName: true, lastName: true },
    with: {
      studentUser: {
        columns: { id: true, email: true, firstName: true, lastName: true, active: true, consensoGenitoreAt: true },
      },
    },
  })

  if (!student) throw createError({ statusCode: 404, statusMessage: 'Studente non trovato' })
  return student
})
