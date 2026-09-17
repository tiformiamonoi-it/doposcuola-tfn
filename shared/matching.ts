// IL TABELLONE DEL MATCHING — il linguaggio comune fra server e pagine (N4, N6).
//
// Qui dentro ci sono due cose:
//   1. la forma dei dati di GET /api/matching/:date, che servono identici alla pagina
//      Matching e al suo foglio di stampa (prima erano copiati a mano nella pagina);
//   2. la regola di chi è "lo stesso alunno". Il server la usa per rifiutare i doppioni,
//      la pagina per colorare di rosso le caselle vietate: una regola sola, così lo
//      schermo e il server non possono mai raccontare due cose diverse.

import { normalizzaTelefono } from './phone'

// ─── La forma dei dati che manda il server ───
// Nata da server/api/matching/[date].get.ts: se cambia là, va cambiata anche qui.
export interface TutorDelGiorno {
  id: string
  name: string
  phone: string | null
  notes: string
  subjects: string[]
  /** true = l'admin può togliere il tutor dal giorno (ha spuntato la disponibilità
   *  oppure è "sempre disponibile"); false = fisso mensile, lun-ven c'è sempre */
  rimovibile: boolean
}

export interface BadgePrenotazione {
  subjectId: string
  bookingId: string
  /** La scheda dell'alunno in anagrafica: manca solo sulle prenotazioni vecchie */
  studentId: string | null
  studentName: string
  studentSurname: string
  studentPhone: string
  subject: string
  notes: string | null
  assignedTutorId: string | null
  /** La fascia oraria, scritta come "15:00-16:00" */
  assignedSlot: string | null
  isAssigned: boolean
  /** Supplemento della materia speciale fuori data: 0 se non previsto */
  supplemento: number
  supplementoApplicato: boolean
}

export interface SlotOrario {
  /** "15:00-16:00": è anche il valore salvato in assignedSlot */
  id: string
  /** "15:00 - 16:00", da mostrare */
  label: string
}

export interface MatchingDelGiorno {
  date: string
  tutors: TutorDelGiorno[]
  badges: BadgePrenotazione[]
  slots: SlotOrario[]
}

// ─── Chi è "lo stesso alunno" (N4) ───

/** Quello che basta, di una prenotazione, per riconoscere l'alunno */
export interface AlunnoPrenotato {
  studentId: string | null
  studentName: string
  studentSurname: string
  studentPhone: string | null
}

// "  ROSSI  " e "rossi" sono lo stesso cognome
function pulito(testo: string | null | undefined): string {
  return (testo ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function stessoAlunno(a: AlunnoPrenotato, b: AlunnoPrenotato): boolean {
  // Tutte e due collegate all'anagrafica: decide la scheda, non il nome
  // (due omonimi veri restano due alunni diversi).
  if (a.studentId && b.studentId) return a.studentId === b.studentId
  // Altrimenti (prenotazioni vecchie senza scheda): stesso nome e cognome E stesso
  // telefono. Il telefono si confronta normalizzato: "333 1234567" e "+393331234567"
  // sono lo stesso numero scritto in due modi.
  return pulito(a.studentName) === pulito(b.studentName)
    && pulito(a.studentSurname) === pulito(b.studentSurname)
    && normalizzaTelefono(a.studentPhone ?? '') === normalizzaTelefono(b.studentPhone ?? '')
}

// ─── Il tabellone: chi sta in quale casella ───

/** "Rossi L.": la targhetta deve stare in una casella stretta */
export function nomeBreve(b: Pick<BadgePrenotazione, 'studentName' | 'studentSurname'>): string {
  const iniziale = b.studentName.trim().charAt(0)
  return `${b.studentSurname.trim()} ${iniziale ? iniziale.toUpperCase() + '.' : ''}`.trim()
}

export function chiaveCasella(tutorId: string, fascia: string): string {
  return `${tutorId}|${fascia}`
}

/**
 * Divide le targhette fra le caselle del tabellone (riga tutor × colonna fascia) e
 * quelle ancora da assegnare, in ordine di cognome così si trovano a colpo d'occhio.
 * Un alunno assegnato a un tutor tolto dal giorno (o a una fascia cancellata) finisce
 * fra i "da assegnare": nel tabellone non avrebbe una casella e sparirebbe dalla vista.
 */
export function dividiTabellone(dati: Pick<MatchingDelGiorno, 'tutors' | 'badges' | 'slots'>) {
  const tutorDelGiorno = new Set(dati.tutors.map(t => t.id))
  const fasce = new Set(dati.slots.map(s => s.id))
  const perCasella = new Map<string, BadgePrenotazione[]>()
  const daAssegnare: BadgePrenotazione[] = []

  const inOrdine = [...dati.badges].sort((a, b) =>
    a.studentSurname.localeCompare(b.studentSurname, 'it') || a.studentName.localeCompare(b.studentName, 'it'))

  for (const b of inOrdine) {
    if (b.isAssigned && b.assignedTutorId && b.assignedSlot
      && tutorDelGiorno.has(b.assignedTutorId) && fasce.has(b.assignedSlot)) {
      const chiave = chiaveCasella(b.assignedTutorId, b.assignedSlot)
      const casella = perCasella.get(chiave)
      if (casella) casella.push(b)
      else perCasella.set(chiave, [b])
    } else {
      daAssegnare.push(b)
    }
  }
  return { perCasella, daAssegnare }
}

/** "1 alunno", "3 alunni" */
export function quantiAlunni(n: number): string {
  return n === 1 ? '1 alunno' : `${n} alunni`
}
