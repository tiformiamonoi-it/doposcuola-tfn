// Augmenta i tipi di nuxt-auth-utils con il modello utente di Ti Formiamo Noi.
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
    // Tutorial di benvenuto al primo accesso (tutor/famiglia/studente)
    tutorialVisto?: boolean
  }

  interface UserSession {
    user: User
  }

  // Dati cifrati nel cookie, non esposti al client
  interface SecureSessionData {
    passwordHash?: never
  }
}
