import { eq, desc } from 'drizzle-orm'
import { db } from '../database/client'
import { students, studentNotes } from '../database/schema'

// Carica tutti gli studenti collegati a un GENITORE
export async function getPortalStudents(linkedStudentIds: string[]) {
  if (linkedStudentIds.length === 0) return []

  const result = await db.query.students.findMany({
    where: (s, { inArray }) => inArray(s.id, linkedStudentIds),
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
          stati: true,
          dataScadenza: true,
        },
        where: (p, { not, arrayContains }) =>
          not(arrayContains(p.stati, ['CHIUSO'])),
        orderBy: (p, { desc }) => [desc(p.createdAt)],
        limit: 1,
      }
    }
  })

  return result
}

// Note con visibilità FAMIGLIA per gli studenti collegati al GENITORE
export async function getPortalNotes(linkedStudentIds: string[]) {
  if (linkedStudentIds.length === 0) return []

  const result = await db.query.studentNotes.findMany({
    where: (n, { inArray, and, eq }) =>
      and(
        inArray(n.studentId, linkedStudentIds),
        eq(n.visibilita, 'FAMIGLIA')
      ),
    orderBy: [desc(studentNotes.createdAt)],
    with: {
      author: {
        columns: { firstName: true, lastName: true, role: true }
      },
      student: {
        columns: { firstName: true, lastName: true }
      }
    }
  })

  return result
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
          where: (p, { arrayContains }) => arrayContains(p.stati, ['ATTIVO']),
        }
      }
    })

    if (student?.abilitatoPrenotazioneOnline && (student.packages?.length ?? 0) > 0) {
      return true
    }
  }

  return false
}
