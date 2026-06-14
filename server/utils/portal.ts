import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { students } from '../database/schema'

// Recupera SEMPRE dal DB gli ID degli studenti collegati a un genitore.
// Evita la staleness della sessione (figli collegati dopo il login).
export async function getLinkedStudentIds(userId: string): Promise<string[]> {
  const rows = await db.query.students.findMany({
    where: eq(students.portalUserId, userId),
    columns: { id: true },
  })
  return rows.map((r) => r.id)
}
