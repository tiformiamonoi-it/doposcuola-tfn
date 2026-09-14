// L'INGRESSO NEL GESTIONALE — UNO SOLO, PER TUTTE LE PORTE.
//
// Nel gestionale si entra da due porte diverse:
//   1. il modulo di accesso (email + password) — /api/auth/login
//   2. il link "scegli la tua password": appena scelta, la persona è già dentro
//      e non deve ridigitare niente — /api/auth/imposta-password
//
// Le due porte devono aprire ESATTAMENTE la stessa sessione. Il motivo è
// pratico: dentro la sessione non c'è solo "chi sei", ci sono anche i figli
// collegati, i documenti legali ancora da accettare e le autorizzazioni dei
// minori di 14 anni. Se una delle due porte dimenticasse uno di quei campi, la
// persona si ritroverebbe un portale mezzo vuoto oppure un blocco che non si
// chiude mai — e nessuno capirebbe perché succede solo "quando entro dal link".
//
// Per questo la sessione si prepara QUI, in un posto solo, e le due porte la
// chiamano entrambe. Aggiungere un campo alla sessione domani vuol dire
// toccare questo file e basta.

import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { students, studentParents, users } from '../database/schema'
import { TERMS_VERSION, PRIVACY_STUDENTE_VERSION } from '#shared/legal'
import { dichiarazioniMinoriMancanti } from '../services/consensi.service'
import { salvaSessioneUtente } from './session'

/** La riga dell'account così com'è nel database: la leggono entrambe le porte. */
type UtenteDb = typeof users.$inferSelect

/**
 * Apre la sessione di un utente che ha appena dimostrato di essere lui
 * (password corretta, oppure link monouso valido e appena bruciato) e dice
 * dove accompagnarlo.
 *
 * `ricordami` decide solo la durata del cookie (vedi utils/session.ts).
 *
 * ATTENZIONE: qui dentro c'è l'ULTIMO controllo sull'account disattivato. Chi
 * chiama dovrebbe averlo già fatto con il proprio messaggio, ma questo secondo
 * controllo è voluto: è il punto obbligato da cui passano tutti gli ingressi,
 * quindi una porta nuova aggiunta domani non potrà dimenticarselo.
 */
export async function apriSessioneAccesso(
  event: Parameters<typeof salvaSessioneUtente>[0],
  user: UtenteDb,
  ricordami: boolean,
): Promise<{ redirectTo: string }> {
  if (!user.active) {
    throw createError({ statusCode: 403, message: 'Account non attivo' })
  }

  // GENITORE: figli collegati via student_parents (supporto fratelli e più genitori).
  // STUDENTE: sé stesso.
  let linkedStudentIds: string[] | undefined
  if (user.role === 'GENITORE') {
    const linked = await db.query.studentParents.findMany({
      where: eq(studentParents.parentUserId, user.id),
      columns: { studentId: true },
    })
    linkedStudentIds = linked.map((s) => s.studentId)
  } else if (user.role === 'STUDENTE') {
    const linked = await db.query.students.findMany({
      where: eq(students.studentUserId, user.id),
      columns: { id: true },
    })
    linkedStudentIds = linked.map((s) => s.id)
  }

  // GENITORE: termini + privacy; STUDENTE: privacy studente
  const termsAccepted = user.role === 'GENITORE'
    ? user.termsAcceptedVersion === TERMS_VERSION
    : user.role === 'STUDENTE'
      ? user.termsAcceptedVersion === PRIVACY_STUDENTE_VERSION
      : true

  // I figli sotto i 14 anni per cui manca ancora l'autorizzazione del genitore
  // (blocco 5). Si calcola qui, all'ingresso, e viaggia dentro la sessione: la
  // schermata che la chiede si apre prima che le API del portale siano aperte,
  // quindi non potrebbe andarsela a prendere da sola.
  const dichiarazioniMinori = user.role === 'GENITORE'
    ? await dichiarazioniMinoriMancanti(linkedStudentIds ?? [])
    : undefined

  await salvaSessioneUtente(event, {
    id:                 user.id,
    email:              user.email,
    firstName:          user.firstName,
    lastName:           user.lastName,
    role:               user.role,
    linkedStudentIds,
    mustChangePassword: user.mustChangePassword,
    termsAccepted,
    dichiarazioniMinori,
    tutorialVisto:      user.tutorialVisto,
  }, ricordami)

  // Dove accompagnare la persona appena entrata. L'ordine conta: prima le cose
  // obbligatorie (password temporanea, documenti da firmare), poi la sua home.
  let redirectTo = ['GENITORE', 'STUDENTE'].includes(user.role) ? '/portale' : (user.role === 'TUTOR' ? '/area-tutor' : '/')
  if (user.mustChangePassword) redirectTo = '/cambio-password'
  else if (!termsAccepted || (dichiarazioniMinori?.length ?? 0) > 0) redirectTo = '/portale/accetta-termini'

  return { redirectTo }
}
