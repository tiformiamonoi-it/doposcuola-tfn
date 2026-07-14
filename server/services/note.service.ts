import { eq, desc, and, isNull, count } from 'drizzle-orm'
import { db } from '../database/client'
import { studentNotes, users } from '../database/schema'
import type { CreateNoteInput, UpdateNoteInput } from '#shared/schemas/note.schema'

// Approvazione note FAMIGLIA: quelle scritte da un TUTOR restano in attesa
// (approvataAt NULL) finché ADMIN/SUPER_TUTOR non le approva.
const RUOLI_APPROVATORI = ['ADMIN', 'SUPER_TUTOR']

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
  if (!note) throw new Error('Nota non trovata')
  return note
}

// Crea una nota. Le note INTERNA e quelle di ADMIN/SUPER_TUTOR nascono approvate;
// le note FAMIGLIA di un TUTOR restano in attesa (approvataAt NULL).
export async function createNote(data: CreateNoteInput, author: { id: string; role: string }) {
  const autoApprovata = data.visibilita !== 'FAMIGLIA' || RUOLI_APPROVATORI.includes(author.role)
  const [nota] = await db.insert(studentNotes).values({
    ...data,
    authorId: author.id,
    approvataAt: autoApprovata ? new Date() : null,
  }).returning()
  return nota
}

// Approva una nota FAMIGLIA in attesa
export async function approveNote(id: string, sessionUser: { role: string }) {
  if (!RUOLI_APPROVATORI.includes(sessionUser.role)) {
    throw new Error('Non hai i permessi per approvare le note')
  }
  const [updated] = await db.update(studentNotes)
    .set({ approvataAt: new Date(), updatedAt: new Date() })
    .where(and(eq(studentNotes.id, id), isNull(studentNotes.approvataAt)))
    .returning()
  if (!updated) throw new Error('Nota non trovata o già approvata')
  return updated
}

// Quante note FAMIGLIA aspettano l'approvazione (badge in nav per ADMIN/SUPER_TUTOR)
export async function countPendingNotes(): Promise<number> {
  const [row] = await db.select({ n: count() })
    .from(studentNotes)
    .where(and(eq(studentNotes.visibilita, 'FAMIGLIA'), isNull(studentNotes.approvataAt)))
  return row?.n ?? 0
}

// Helper RBAC
function assertCanEditOrDelete(note: any, sessionUser: any) {
  const isAdminOrSuper = ['ADMIN', 'SUPER_TUTOR'].includes(sessionUser.role)
  const isAuthor = note.authorId === sessionUser.id

  if (!isAdminOrSuper && !isAuthor) {
    throw new Error('Non hai i permessi per modificare o eliminare questa nota')
  }
}

// Modifica una nota. Se un TUTOR modifica una nota FAMIGLIA (anche già approvata),
// la nota torna in attesa di approvazione.
export async function updateNote(id: string, data: UpdateNoteInput, sessionUser: any) {
  const nota = await getNoteById(id)

  assertCanEditOrDelete(nota, sessionUser)

  const visibilitaFinale = data.visibilita ?? nota.visibilita
  const approvataAt = visibilitaFinale !== 'FAMIGLIA' || RUOLI_APPROVATORI.includes(sessionUser.role)
    ? (nota.approvataAt ?? new Date())
    : null

  const [updated] = await db.update(studentNotes)
    .set({
      ...data,
      approvataAt,
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
