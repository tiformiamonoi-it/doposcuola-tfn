import { eq, desc, arrayContains, not, inArray, and, isNotNull, gt, count } from 'drizzle-orm'
import { db } from '../database/client'
import { students, studentNotes, packages, users } from '../database/schema'

// Carica tutti gli studenti collegati a un GENITORE
export async function getPortalStudents(linkedStudentIds: string[]) {
  if (linkedStudentIds.length === 0) return []

  const result = await db.query.students.findMany({
    where: inArray(students.id, linkedStudentIds),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      classe: true,
      scuola: true,
      abilitatoPrenotazioneOnline: true,
    },
    with: {
      packages: {
        columns: {
          id: true,
          nome: true,
          tipo: true,
          oreResiduo: true,
          oreAcquistate: true,
          giorniResiduo: true,
          giorniAcquistati: true,
          orarioGiornaliero: true,
          stati: true,
          dataScadenza: true,
        },
        where: not(arrayContains(packages.stati, ['CHIUSO'])),
        orderBy: [desc(packages.createdAt)],
        limit: 1,
      }
    }
  })

  return result
}

// Note con visibilità FAMIGLIA (e approvate) per gli studenti collegati al GENITORE.
// L'autore non viene mai esposto alla famiglia: risulta sempre "Segreteria".
export async function getPortalNotes(linkedStudentIds: string[]) {
  if (linkedStudentIds.length === 0) return []

  const result = await db.query.studentNotes.findMany({
    where: and(
        inArray(studentNotes.studentId, linkedStudentIds),
        eq(studentNotes.visibilita, 'FAMIGLIA'),
        isNotNull(studentNotes.approvataAt)
      ),
    orderBy: [desc(studentNotes.createdAt)],
    with: {
      student: {
        columns: { firstName: true, lastName: true }
      }
    }
  })

  return result.map((n) => ({
    ...n,
    author: { firstName: 'Segreteria', lastName: '', role: null },
  }))
}

// Quante note approvate sono arrivate dopo l'ultima visita alla pagina Note (badge nav famiglia)
export async function getUnseenNotesCount(userId: string, linkedStudentIds: string[]): Promise<number> {
  if (linkedStudentIds.length === 0) return 0

  const [u] = await db.select({ last: users.noteLastSeenAt }).from(users).where(eq(users.id, userId)).limit(1)

  const conds = [
    inArray(studentNotes.studentId, linkedStudentIds),
    eq(studentNotes.visibilita, 'FAMIGLIA'),
    isNotNull(studentNotes.approvataAt),
  ]
  if (u?.last) conds.push(gt(studentNotes.approvataAt, u.last))

  const [row] = await db.select({ n: count() }).from(studentNotes).where(and(...conds))
  return row?.n ?? 0
}

// Registra la visita alla pagina Note (azzera il badge)
export async function markNotesSeen(userId: string) {
  await db.update(users).set({ noteLastSeenAt: new Date() }).where(eq(users.id, userId))
  return { ok: true }
}

// Controlla se almeno uno studente collegato è abilitato alla prenotazione online
// e ha un pacchetto attivo
export async function checkPrenotazioneAbilitata(linkedStudentIds: string[]): Promise<boolean> {
  if (linkedStudentIds.length === 0) return false

  for (const studentId of linkedStudentIds) {
    const student = await db.query.students.findFirst({
      where: eq(students.id, studentId),
      columns: { abilitatoPrenotazioneOnline: true },
      with: {
        packages: {
          columns: { stati: true },
          limit: 1,
          where: arrayContains(packages.stati, ['ATTIVO']),
        }
      }
    })

    if (student?.abilitatoPrenotazioneOnline && (student.packages?.length ?? 0) > 0) {
      return true
    }
  }

  return false
}
