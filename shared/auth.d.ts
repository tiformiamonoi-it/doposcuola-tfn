// Augmenta i tipi di nuxt-auth-utils con il modello utente di tiformiamonoi.
// Questi tipi sono usati da useUserSession() nel frontend e getUserSession() nel server.
//
// Sta in shared/ (e non in app/types/) perché ../shared/**/*.d.ts è incluso sia dal
// tsconfig dell'app sia da quello del server: così anche il codice in server/ vede
// i campi di User (prima erano visibili solo lato client).

export type UserRole = 'ADMIN' | 'SUPER_TUTOR' | 'TUTOR' | 'GENITORE' | 'STUDENTE'

declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    role: UserRole
    // Solo per GENITORE: ID degli studenti collegati al portale (supporto fratelli)
    linkedStudentIds?: string[]
    // Password temporanea: obbligo di cambio al primo accesso
    mustChangePassword?: boolean
    // GENITORE/STUDENTE: false finché non accetta la versione corrente dei documenti legali
    termsAccepted?: boolean
    // Solo GENITORE: i figli sotto i 14 anni per cui manca ancora la dichiarazione
    // di autorizzazione (blocco 5). Finché l'elenco non è vuoto il portale chiede
    // di firmarla, come fa con i documenti legali. Viaggia nella sessione e non in
    // una chiamata a parte perché la schermata di accettazione si apre PRIMA che
    // le API del portale siano raggiungibili (vedi server/middleware/01.auth-guard).
    dichiarazioniMinori?: { id: string; nome: string }[]
    // Tutorial di benvenuto al primo accesso (tutor/famiglia/studente)
    tutorialVisto?: boolean
  }

  interface UserSession {
    user: User
    // Login "ricordami": decide la durata del cookie di sessione (vedi server/utils/session.ts)
    ricordami?: boolean
  }

  // Dati cifrati nel cookie, non esposti al client
  interface SecureSessionData {
    passwordHash?: never
  }
}
