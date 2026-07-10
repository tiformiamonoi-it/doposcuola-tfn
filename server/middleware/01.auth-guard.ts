import { isPublicApi, allowedRolesFor } from '../utils/auth-policy'

// Guardia globale: ogni route /api/** richiede login + ruolo ammesso.
// Eccezioni: login e endpoint di sessione (PUBLIC_API_PREFIXES).
export default defineEventHandler(async (event) => {
  const path = event.path || ''

  // Solo le API sono protette qui (le pagine hanno i middleware Nuxt lato client)
  if (!path.startsWith('/api/')) return

  // Endpoint pubblici (login, sessione)
  if (isPublicApi(path)) return

  // Richiede una sessione valida — lancia 401 se assente
  const { user } = await requireUserSession(event)

  // Controllo ruolo in base alla policy (metodo HTTP incluso: le scritture possono richiedere ruoli più alti)
  const allowed = allowedRolesFor(path, event.method)
  if (!allowed.includes(user.role as any)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso non consentito per il tuo ruolo' })
  }

  // Password temporanea: tutto bloccato tranne gli endpoint auth (cambio password, logout)
  if (user.mustChangePassword && !path.startsWith('/api/auth/')) {
    throw createError({ statusCode: 403, statusMessage: 'Cambio password obbligatorio' })
  }

  // Genitore che non ha ancora accettato termini & privacy: API del portale bloccate
  if (user.role === 'GENITORE' && user.termsAccepted === false && path.startsWith('/api/portal')) {
    throw createError({ statusCode: 403, statusMessage: 'Accettazione termini e privacy richiesta' })
  }
})
