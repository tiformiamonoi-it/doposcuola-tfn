import { eq, desc } from 'drizzle-orm'
import { db } from '../../database/client'
import { studentNotes, students } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const notes = await db.query.studentNotes.findMany({
    where: eq(studentNotes.authorId, user.id),
    orderBy: [desc(studentNotes.createdAt)],
    with: {
      student: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        }
      }
    }
  })

  return notes
})
