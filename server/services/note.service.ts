import { eq, desc } from 'drizzle-orm'
import { db } from '../database/client'
import { studentNotes, users } from '../database/schema'
import type { CreateNoteInput, UpdateNoteInput } from '#shared/schemas/note.schema'

// Restituisce le note per uno studente
export async function listStudentNotes(studentId: string) {
  return await db.query.studentNotes.findMany({
    where: eq(studentNotes.studentId, studentId),
    orderBy: [desc(studentNotes.createdAt)],
    with: {
      author: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
        }
      },
      lesson: true
    }
  })
}

// Ottieni singola nota
export async function getNoteById(id: string) {
  const note = await db.query.studentNotes.findFirst({
    where: eq(studentNotes.id, id),
    with: {
      author: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
        }
      }
    }
  })
  if (!note) throw createError({ statusCode: 404, statusMessage: 'Nota non trovata' })
  return note
}

// Crea una nota
export async function createNote(data: CreateNoteInput, authorId: string) {
  const [nota] = await db.insert(studentNotes).values({
    ...data,
    authorId
  }).returning()
  return nota
}

// Helper RBAC
function assertCanEditOrDelete(note: any, sessionUser: any) {
  const isAdminOrSuper = ['ADMIN', 'SUPER_TUTOR'].includes(sessionUser.role)
  const isAuthor = note.authorId === sessionUser.id

  if (!isAdminOrSuper && !isAuthor) {
    throw createError({ 
      statusCode: 403, 
      statusMessage: 'Non hai i permessi per modificare o eliminare questa nota' 
    })
  }
}

// Modifica una nota
export async function updateNote(id: string, data: UpdateNoteInput, sessionUser: any) {
  const nota = await getNoteById(id)
  
  assertCanEditOrDelete(nota, sessionUser)

  const [updated] = await db.update(studentNotes)
    .set({
      ...data,
      updatedAt: new Date()
    })
    .where(eq(studentNotes.id, id))
    .returning()
    
  return updated
}

// Elimina una nota
export async function deleteNote(id: string, sessionUser: any) {
  const nota = await getNoteById(id)
  
  assertCanEditOrDelete(nota, sessionUser)

  await db.delete(studentNotes).where(eq(studentNotes.id, id))
  return { success: true }
}
