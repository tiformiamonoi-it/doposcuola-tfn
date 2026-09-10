import { verificaToken } from '../../utils/password-token'
import { rateLimitExceeded } from '../../utils/rate-limit'

// GET /api/auth/imposta-password?token=... — PUBBLICO (in PUBLIC_API_PREFIXES).
// Serve solo alla pagina /imposta-password per sapere se il link è ancora buono
// e come salutare la persona.
//
// PRIVACY: non torna MAI l'email né altri dati personali. Solo il nome di
// battesimo, che è già scritto nell'email/messaggio con cui il link è arrivato.
// Così chi provasse token a caso non potrebbe usarli per pescare indirizzi.
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'sconosciuto'
  // Limite largo: la pagina si può ricaricare, il link si può riaprire.
  // Serve solo a fermare chi provasse token a raffica.
  if (rateLimitExceeded(`imposta-password-get:${ip}`, 30, 10 * 60 * 1000)) {
    throw createError({ statusCode: 429, statusMessage: 'Troppi tentativi: riprova tra qualche minuto' })
  }

  const token = getQuery(event).token
  if (typeof token !== 'string' || !token) {
    return { valido: false as const }
  }

  const esito = await verificaToken(token)
  if (!esito) return { valido: false as const }

  return {
    valido: true as const,
    nome:   esito.nome,
    scopo:  esito.scopo,
  }
})
