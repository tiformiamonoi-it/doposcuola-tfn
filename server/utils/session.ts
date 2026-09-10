import type { User } from '#auth-utils'

// Durata dell'accesso "ricordato": il cookie di sessione diventa permanente
// e le famiglie reinseriscono email e password una volta al mese.
export const RICORDAMI_MAX_AGE = 60 * 60 * 24 * 30 // 30 giorni

// nuxt-auth-utils RISCRIVE il cookie a ogni setUserSession(). Se un endpoint
// qualsiasi (cambio password, accettazione termini, tutorial visto…) lo riscrive
// senza durata, il cookie torna "di sessione" e l'utente viene di nuovo buttato
// fuori alla chiusura dell'app. Per questo TUTTI gli endpoint che aggiornano la
// sessione devono passare da qui: la scelta "ricordami" viaggia dentro la
// sessione stessa e viene riapplicata a ogni riscrittura.
export async function salvaSessioneUtente(
  event: Parameters<typeof setUserSession>[0],
  user: User,
  ricordami?: boolean,
) {
  const sessione = await getUserSession(event)
  // Al login la scelta arriva dal form; dopo si eredita quella già in sessione.
  const ricorda = ricordami ?? sessione.ricordami ?? false

  // Solo `maxAge`, MAI `cookie.maxAge`: così h3 calcola l'Expires del cookie come
  // createdAt + 30 giorni, lo stesso istante in cui scade il sigillo cifrato.
  // Cookie e contenuto muoiono insieme, senza finestre in cui uno sopravvive all'altro.
  return setUserSession(
    event,
    { user, ricordami: ricorda },
    ricorda ? { maxAge: RICORDAMI_MAX_AGE } : {},
  )
}
