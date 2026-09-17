import { eq, desc, and, isNull, count } from 'drizzle-orm'
import type { User } from '#auth-utils'
import { db } from '../database/client'
import { studentNotes, students, users } from '../database/schema'
import { creaNotifica, segnaLetteDellaPratica } from './notifiche.service'
import type { CreateNoteInput, UpdateNoteInput } from '#shared/schemas/note.schema'

// Approvazione note FAMIGLIA: quelle scritte da un TUTOR restano in attesa
// (approvataAt NULL) finché ADMIN/SUPER_TUTOR non le approva.
const RUOLI_APPROVATORI = ['ADMIN', 'SUPER_TUTOR']

// Chi sta scrivendo, modificando o cancellando: l'utente della sessione.
// Il nome serve al testo dell'avviso nel campanellino.
type ChiAgisce = Pick<User, 'id' | 'role' | 'firstName' | 'lastName'>

// ─────────────────────────────────────────────
// L'AVVISO NEL CAMPANELLINO
// Quando un Tutor o un Super Tutor scrive, modifica o cancella una nota, la
// segreteria lo vede nel campanellino senza dover aprire la scheda di ogni alunno.
// Quando agisce un ADMIN non suona mai: è la segreteria stessa, e avvisarla di
// quello che ha appena fatto con le sue mani sarebbe solo rumore.
// ─────────────────────────────────────────────
const RUOLO_IN_ITALIANO: Partial<Record<User['role'], string>> = {
  TUTOR:       'Tutor',
  SUPER_TUTOR: 'Super Tutor',
}

// Le prime parole della nota, quanto basta per capire di cosa parla senza aprirla.
// Spazi e a capo diventano uno spazio solo; il taglio cade su uno spazio (mai a
// metà parola) e i puntini dicono che il testo continua.
function primeParole(testo: string, massimo = 120): string {
  const pulito = testo.replace(/\s+/g, ' ').trim()
  if (pulito.length <= massimo) return pulito
  const spazio = pulito.lastIndexOf(' ', massimo)
  return `${pulito.slice(0, spazio > 0 ? spazio : massimo)}…`
}

async function avvisaCampanellino(
  azione: 'CREATA' | 'MODIFICATA' | 'CANCELLATA',
  nota: { id: string; studentId: string; contenuto: string; visibilita: string; approvataAt: Date | null },
  chi: ChiAgisce,
) {
  const ruolo = RUOLO_IN_ITALIANO[chi.role]
  if (!ruolo) return

  // Si chiama DOPO che la nota è già salvata (o cancellata), e un errore qui si
  // ingoia: un campanellino che non suona è un fastidio, una nota persa è un danno.
  try {
    const [alunno] = await db
      .select({ firstName: students.firstName, lastName: students.lastName })
      .from(students)
      .where(eq(students.id, nota.studentId))
      .limit(1)
    const nomeAlunno = alunno ? `${alunno.firstName} ${alunno.lastName}`.trim() : 'un alunno'
    const autore = `${chi.firstName} ${chi.lastName}`.trim()

    // "da approvare" solo finché c'è davvero qualcosa da approvare: su una nota
    // appena cancellata non c'è più niente da fare.
    const visibilita = nota.visibilita !== 'FAMIGLIA'
      ? 'interna'
      : nota.approvataAt || azione === 'CANCELLATA' ? 'per la famiglia' : 'per la famiglia — da approvare'

    const titolo = azione === 'CREATA'
      ? `Nuova nota su ${nomeAlunno}`
      : `${autore} ha ${azione === 'MODIFICATA' ? 'modificato' : 'cancellato'} una nota su ${nomeAlunno}`

    await creaNotifica({
      tipo: 'GENERICA',
      // La colonna tiene 200 caratteri: con nomi normali non si arriva mai, ma due
      // nomi lunghissimi non devono far saltare l'avviso
      titolo:    titolo.slice(0, 200),
      messaggio: `${autore} (${ruolo}) · ${visibilita} · «${primeParole(nota.contenuto)}»`,
      // Anche per una nota cancellata: la scheda dell'alunno c'è ancora
      link:       `/studenti/${nota.studentId}?tab=note`,
      entityType: 'nota',
      entityId:   nota.id,
      // Una nota ritoccata tre volte di fila è UNA notizia: se l'avviso di questa
      // nota (di creazione o di modifica) è ancora da leggere, basta quello.
      // Creazione e cancellazione invece fanno sempre un avviso nuovo.
      evitaDoppioni: azione === 'MODIFICATA',
    })
  } catch (err) {
    console.warn('[note] nota salvata, ma l\'avviso nel campanellino non è partito:', err)
  }
}

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
export async function createNote(data: CreateNoteInput, author: ChiAgisce) {
  const autoApprovata = data.visibilita !== 'FAMIGLIA' || RUOLI_APPROVATORI.includes(author.role)
  const [nota] = await db.insert(studentNotes).values({
    ...data,
    authorId: author.id,
    approvataAt: autoApprovata ? new Date() : null,
  }).returning()
  if (nota) await avvisaCampanellino('CREATA', nota, author)
  return nota
}

// Approva una nota FAMIGLIA in attesa
export async function approveNote(id: string, sessionUser: { id: string; role: string }) {
  if (!RUOLI_APPROVATORI.includes(sessionUser.role)) {
    throw new Error('Non hai i permessi per approvare le note')
  }
  const [updated] = await db.update(studentNotes)
    .set({ approvataAt: new Date(), updatedAt: new Date() })
    .where(and(eq(studentNotes.id, id), isNull(studentNotes.approvataAt)))
    .returning()
  if (!updated) throw new Error('Nota non trovata o già approvata')

  // Approvata: gli avvisi ancora aperti su questa nota ("… da approvare") hanno
  // fatto il loro lavoro e si spengono, a nome di chi ha approvato. Se non ci si
  // riesce pazienza: l'approvazione è già salvata, ed è lei che conta.
  try {
    await segnaLetteDellaPratica('nota', id, sessionUser.id)
  } catch (err) {
    console.warn('[note] nota approvata, ma i suoi avvisi non sono stati segnati letti:', err)
  }
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
function assertCanEditOrDelete(note: { authorId: string }, sessionUser: ChiAgisce) {
  const isAdminOrSuper = ['ADMIN', 'SUPER_TUTOR'].includes(sessionUser.role)
  const isAuthor = note.authorId === sessionUser.id

  if (!isAdminOrSuper && !isAuthor) {
    throw new Error('Non hai i permessi per modificare o eliminare questa nota')
  }
}

// Modifica una nota. Se un TUTOR modifica una nota FAMIGLIA (anche già approvata),
// la nota torna in attesa di approvazione.
export async function updateNote(id: string, data: UpdateNoteInput, sessionUser: ChiAgisce) {
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

  // Le prime parole nell'avviso sono quelle del testo NUOVO
  if (updated) await avvisaCampanellino('MODIFICATA', updated, sessionUser)
  return updated
}

// Elimina una nota
export async function deleteNote(id: string, sessionUser: ChiAgisce) {
  // Letta PRIMA di cancellarla: serve ai permessi e, dopo, al testo dell'avviso
  const nota = await getNoteById(id)
  
  assertCanEditOrDelete(nota, sessionUser)

  await db.delete(studentNotes).where(eq(studentNotes.id, id))
  await avvisaCampanellino('CANCELLATA', nota, sessionUser)
  return { success: true }
}
