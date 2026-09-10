import { consumaToken } from '../../utils/password-token'
import { rateLimitExceeded } from '../../utils/rate-limit'
import { ImpostaPasswordSchema } from '#shared/schemas/password.schema'

// POST /api/auth/imposta-password — PUBBLICO (in PUBLIC_API_PREFIXES).
// Body { token, password }: brucia il link e salva la password scelta dall'utente.
//
// NON crea la sessione di proposito: dopo aver scelto la password la persona
// passa dal login normale, dove trova anche l'interruttore "Ricordami".
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

  try {
    await consumaToken(parsed.data.token, parsed.data.password)
  } catch {
    // Messaggio unico e non tecnico: scaduto, già usato o inesistente sono
    // tutti lo stesso caso per chi legge — e non diciamo quale, così un link
    // provato a caso non rivela nulla.
    throw createError({
      statusCode: 400,
      statusMessage: 'Questo link non è più valido: può essere scaduto o già usato',
    })
  }

  return { ok: true as const }
})
