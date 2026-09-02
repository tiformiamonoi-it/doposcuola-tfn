import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { students, studentParents } from '../database/schema'

// Recupera SEMPRE dal DB gli ID degli studenti collegati a un genitore.
// Evita la staleness della sessione (figli collegati dopo il login).
// I collegamenti stanno nella tabella ponte student_parents (più genitori per alunno).
export async function getLinkedStudentIds(userId: string): Promise<string[]> {
  const rows = await db.query.studentParents.findMany({
    where: eq(studentParents.parentUserId, userId),
    columns: { studentId: true },
  })
  return rows.map((r) => r.studentId)
}

// ID studenti visibili dall'utente del portale, qualunque sia il ruolo:
// GENITORE → i figli collegati; STUDENTE → sé stesso; altri ruoli → nessuno.
export async function getPortalStudentIds(user: { id: string; role: string }): Promise<string[]> {
  if (user.role === 'GENITORE') return getLinkedStudentIds(user.id)
  if (user.role === 'STUDENTE') {
    const rows = await db.query.students.findMany({
      where: eq(students.studentUserId, user.id),
      columns: { id: true },
    })
    return rows.map((r) => r.id)
  }
  return []
}
