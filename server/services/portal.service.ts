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
      // Al portale famiglie NON arrivano ore/giorni residui: la famiglia vede solo
      // lo STATO del pacchetto (attivo, scaduto, esaurito...). I conteggi restano
      // in segreteria. Non basta nasconderli nella pagina: se non escono dal server,
      // non sono leggibili nemmeno dagli strumenti per sviluppatori del browser.
      packages: {
        columns: {
          id: true,
          nome: true,
          tipo: true,
          stati: true,
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
//
// CHI FIRMA (decisione di Alessandro del 14/09/2026)
// Un TUTOR normale firma "Segreteria": la famiglia non deve sapere quale tutor ha
// scritto quella frase, e comunque la nota passa dall'approvazione della
// segreteria prima di partire. Un SUPER_TUTOR o un ADMIN firmano invece con il
// loro nome vero: sono loro a parlare, e una comunicazione che arriva da una
// persona con un nome pesa diversamente da un avviso anonimo.
//
// La firma si decide QUI e non nella pagina: se il nome vero uscisse dal server
// e fosse la pagina a nasconderlo, arriverebbe comunque nel browser di chi non
// deve vederlo — basta aprire gli strumenti del browser per leggerlo.
//
// L'ORDINE è quello in cui le note sono diventate VISIBILI alla famiglia
// (approvataAt), non quello in cui sono state scritte. Prima l'elenco andava per
// data di scrittura mentre il pallino delle non lette contava le approvazioni:
// una nota scritta due settimane fa e approvata oggi accendeva il pallino ma
// finiva in mezzo all'elenco, e il genitore in cima non trovava niente di nuovo.
// Il filtro qui sopra pretende approvataAt non nullo, quindi ogni nota che esce
// da questa funzione ha per forza quella data: nessun caso scoperto.
export async function getPortalNotes(linkedStudentIds: string[]) {
  if (linkedStudentIds.length === 0) return []

  const result = await db.query.studentNotes.findMany({
    where: and(
        inArray(studentNotes.studentId, linkedStudentIds),
        eq(studentNotes.visibilita, 'FAMIGLIA'),
        isNotNull(studentNotes.approvataAt)
      ),
    orderBy: [desc(studentNotes.approvataAt)],
    with: {
      student: {
        columns: { firstName: true, lastName: true }
      },
      author: {
        columns: { firstName: true, lastName: true, role: true }
      }
    }
  })

  return result.map((n) => {
    // Nel dubbio si firma "Segreteria": un ruolo che non riconosciamo non deve
    // mai far uscire un nome per sbaglio.
    const conNome = n.author?.role === 'ADMIN' || n.author?.role === 'SUPER_TUTOR'
    const nome = `${n.author?.firstName ?? ''} ${n.author?.lastName ?? ''}`.trim()

    return {
      ...n,
      author: conNome && nome
        ? { firstName: n.author!.firstName, lastName: n.author!.lastName, role: null }
        : { firstName: 'Segreteria', lastName: '', role: null },
    }
  })
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
