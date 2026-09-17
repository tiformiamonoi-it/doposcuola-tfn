// server/services/disponibilita-tutor.service.ts
//
// LA REGOLA "QUESTO TUTOR C'È D'UFFICIO?" — scritta una volta sola.
//
// Dal lunedì al venerdì un tutor può esserci senza aver spuntato niente:
//  • FORFAIT (fisso mensile): c'è sempre, e non può togliere giorni;
//  • SEMPRE DISPONIBILE (interruttore sulla scheda): c'è sempre, tranne i giorni che ha
//    segnato in tutor_assenze;
//  • tutti gli altri: c'è solo nei giorni che ha spuntato (tutor_availabilities).
// Se un tutor è sia FORFAIT sia sempre disponibile vince il FORFAIT.
// Il sabato vale per tutti la spunta, la domenica il centro è chiuso.
//
// La usano il calendario del tutor, il suo "tocca un giorno", il Matching (elenco e ✕)
// e l'impatto di una chiusura: se ognuno se la riscrivesse, prima o poi il tutor si
// vedrebbe disponibile nel suo calendario e assente nel Matching.
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { users, tutorProfiles, tutorAssenze } from '../database/schema'

export type RegolaFeriale = 'FORFAIT' | 'SEMPRE_DISPONIBILE' | 'A_SPUNTA'

// Lunedì–venerdì. Il giorno della settimana si calcola in UTC dalla data 'AAAA-MM-GG',
// come nel resto del gestionale: così il fuso del server non sposta mai il giorno.
export function giornoFeriale(dateStr: string): boolean {
  const g = new Date(`${dateStr}T00:00:00Z`).getUTCDay()
  return g >= 1 && g <= 5
}

// Come funzionano i giorni feriali per QUESTO tutor (FORFAIT prima di tutto)
export async function regolaFerialeDelTutor(userId: string): Promise<RegolaFeriale> {
  const [profilo] = await db
    .select({ modalitaPagamento: tutorProfiles.modalitaPagamento, sempreDisponibile: tutorProfiles.sempreDisponibile })
    .from(tutorProfiles)
    .where(eq(tutorProfiles.userId, userId))
    .limit(1)
  if (profilo?.modalitaPagamento === 'FORFAIT') return 'FORFAIT'
  if (profilo?.sempreDisponibile) return 'SEMPRE_DISPONIBILE'
  return 'A_SPUNTA'
}

// I tutor ATTIVI che in quella data ci sono d'ufficio: i FORFAIT e i sempre disponibili
// che non hanno segnato l'assenza. Vuoto il sabato e la domenica.
// ⚠️ NON guarda i giorni di chiusura: lo decide chi chiama. Il Matching salta la chiamata
// nei giorni chiusi; l'impatto di una chiusura invece vuole sapere proprio chi ci sarebbe.
export async function tutorDUfficio(dateStr: string) {
  if (!giornoFeriale(dateStr)) return []
  return db
    .select({
      id:        users.id,
      firstName: users.firstName,
      lastName:  users.lastName,
      phone:     users.phone,
      materie:   tutorProfiles.materie,
      forfait:   sql<boolean>`${tutorProfiles.modalitaPagamento} = 'FORFAIT'`,
    })
    .from(users)
    .innerJoin(tutorProfiles, eq(tutorProfiles.userId, users.id))
    .leftJoin(tutorAssenze, and(eq(tutorAssenze.userId, users.id), eq(tutorAssenze.date, dateStr)))
    .where(and(
      eq(users.active, true),
      or(
        eq(tutorProfiles.modalitaPagamento, 'FORFAIT'),
        and(eq(tutorProfiles.sempreDisponibile, true), isNull(tutorAssenze.id)),
      ),
    ))
}
