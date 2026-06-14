// Augmenta i tipi di nuxt-auth-utils con il modello utente di Ti Formiamo Noi.
// Questi tipi sono usati da useUserSession() nel frontend e getUserSession() nel server.

export type UserRole = 'ADMIN' | 'SUPER_TUTOR' | 'TUTOR' | 'GENITORE'

declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    role: UserRole
    // Solo per GENITORE: ID degli studenti collegati al portale (supporto fratelli)
    linkedStudentIds?: string[]
  }

  interface UserSession {
    user: User
  }

  // Dati cifrati nel cookie, non esposti al client
  interface SecureSessionData {
    passwordHash?: never
  }
}
