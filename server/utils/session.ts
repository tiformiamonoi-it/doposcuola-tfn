import type { User } from '#auth-utils'

// Durata dell'accesso "ricordato": il cookie di sessione diventa permanente
// e le famiglie reinseriscono email e password una volta al mese.
export const RICORDAMI_MAX_AGE = 60 * 60 * 24 * 30 // 30 giorni

// Accesso SENZA "ricordami": il cookie resta "di sessione" (sparisce quando si chiude
// il browser), ma il contenuto sigillato scade comunque dopo 12 ore. Serve per il
// computer condiviso lasciato acceso: prima quella sessione non scadeva mai.
export const SESSIONE_BREVE_MAX_AGE = 60 * 60 * 12 // 12 ore

type OpzioniSessione = NonNullable<Parameters<typeof setUserSession>[2]>

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
  //
  // Senza "ricordami" invece si passa solo `seal.ttl`, MAI `maxAge`: in h3 1.15
  // `maxAge` metterebbe anche l'Expires sul cookie (che non sarebbe più "di sessione"),
  // mentre `seal.ttl` scrive la scadenza SOLO dentro il sigillo (h3 la fonde sopra
  // il proprio ttl in sealSession). In lettura non serve configurare niente:
  // iron-webcrypto, quando apre il sigillo, controlla sempre la scadenza scritta
  // dentro (protetta dalla firma, quindi non modificabile) e, se è passata, h3
  // tratta il cookie come vuoto → requireUserSession risponde 401.
  // Le 12 ore ripartono a ogni riscrittura della sessione (cambio password,
  // accettazione documenti…), non a ogni chiamata.
  return setUserSession(
    event,
    { user, ricordami: ricorda },
    ricorda
      ? { maxAge: RICORDAMI_MAX_AGE }
      // Il tipo vuole tutte le opzioni del sigillo; h3 mette le altre dai suoi default.
      : { seal: { ttl: SESSIONE_BREVE_MAX_AGE * 1000 } as OpzioniSessione['seal'] },
  )
}
