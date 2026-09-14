import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { users } from '../../database/schema'
import { consumaToken } from '../../utils/password-token'
import { apriSessioneAccesso } from '../../utils/accesso'
import { rateLimitExceeded } from '../../utils/rate-limit'
import { ImpostaPasswordSchema } from '#shared/schemas/password.schema'

// POST /api/auth/imposta-password — PUBBLICO (in PUBLIC_API_PREFIXES).
// Body { token, password }: brucia il link, salva la password scelta dall'utente
// e lo fa ENTRARE subito, senza fargli ridigitare email e password.
//
// Perché: prima la persona sceglieva la password, leggeva "Password salvata" e
// restava fuori. Era la telefonata più frequente in segreteria — "ho fatto la
// password ma non sono dentro". Chi ha appena usato un link monouso arrivato al
// suo indirizzo ha già dimostrato di essere lui: chiedergli di ridimostrarlo
// subito dopo non aggiunge sicurezza, aggiunge solo un ostacolo.
//
// L'ORDINE DEI PASSI NON È CASUALE:
//   1. si brucia il gettone e si salva la password (una sola transazione)
//   2. solo dopo si apre la sessione
// Così un link vale UNA volta sola: se la pagina viene ricaricata e rimandata,
// il secondo tentativo trova il gettone già speso e non apre nessuna sessione.
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'sconosciuto'
  // Un po' più largo del "password dimenticata": qui è normale sbagliare
  // (password troppo corta, le due non coincidono) e riprovare.
  if (rateLimitExceeded(`imposta-password-post:${ip}`, 10, 10 * 60 * 1000)) {
    throw createError({ statusCode: 429, statusMessage: 'Troppi tentativi: riprova tra qualche minuto' })
  }

  const body = await readBody(event)
  const parsed = ImpostaPasswordSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: parsed.error.issues[0]?.message ?? 'Password non valida',
    })
  }

  let userId: string
  try {
    // consumaToken() rifiuta anche gli account disattivati, come fa l'accesso
    // normale: chi è sospeso non entra nemmeno da questa strada.
    const esito = await consumaToken(parsed.data.token, parsed.data.password)
    userId = esito.userId
  } catch {
    // Messaggio unico e non tecnico: scaduto, già usato o inesistente sono
    // tutti lo stesso caso per chi legge — e non diciamo quale, così un link
    // provato a caso non rivela nulla.
    throw createError({
      statusCode: 400,
      statusMessage: 'Questo link non è più valido: può essere scaduto o già usato',
    })
  }

  // Rilettura DOPO la transazione: la riga qui ha già mustChangePassword a false
  // (l'ha appena messo consumaToken), quindi il gate del "cambio password
  // obbligatorio" non scatta e la persona non si vede chiedere di rifarla.
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user || !user.active) {
    // Rete di sicurezza: la password è comunque già stata cambiata, ma la
    // sessione non si apre. Messaggio esplicito, non il solito "link scaduto":
    // qui il link andava bene, è l'account che è chiuso.
    throw createError({
      statusCode: 403,
      statusMessage: 'Questo account non è attivo: contatta la segreteria',
    })
  }

  // Stessa sessione dell'accesso normale, preparata dallo stesso codice.
  // "Ricordami" acceso: qui non c'è l'interruttore da spuntare e il valore
  // predefinito del modulo di accesso è già questo — le famiglie non devono
  // ritrovarsi fuori appena chiudono l'app.
  const { redirectTo } = await apriSessioneAccesso(event, user, true)

  return { ok: true as const, redirectTo }
})
