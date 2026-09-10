import { eq } from 'drizzle-orm'
import { db } from '../../../../database/client'
import { students, users } from '../../../../database/schema'

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
        columns: {
          id: true, email: true, firstName: true, lastName: true, active: true,
          consensoGenitoreAt: true, consensoGenitoreRegistratoDaUserId: true,
        },
      },
    },
  })

  if (!student) throw createError({ statusCode: 404, statusMessage: 'Studente non trovato' })

  // Chi ha raccolto il consenso del genitore: una query in più, e solo quando
  // quel consenso esiste davvero. Non passa da una relation Drizzle perché
  // users→users è un auto-riferimento: dichiararlo costringerebbe a inventare
  // una relazione "inversa" che non serve a nessun'altra pagina.
  let consensoRegistratoDa: { firstName: string; lastName: string } | null = null
  const operatoreId = student.studentUser?.consensoGenitoreRegistratoDaUserId
  if (operatoreId) {
    const operatore = await db.query.users.findFirst({
      where: eq(users.id, operatoreId),
      columns: { firstName: true, lastName: true },
    })
    consensoRegistratoDa = operatore ?? null
  }

  return { ...student, consensoRegistratoDa }
})
