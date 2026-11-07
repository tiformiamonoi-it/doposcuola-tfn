import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { users } from '../database/schema'
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

  // IL COOKIE DICE CHI SEI, IL DATABASE DICE SE PUOI ANCORA ENTRARE.
  // Il cookie è sigillato e non si può falsificare, ma non si può nemmeno
  // "ritirare": senza questo controllo un account disattivato, o con la password
  // appena cambiata, restava dentro dai dispositivi già collegati fino a 30 giorni.
  // Una sola lettura per chiave primaria, poche colonne: costa meno di un millisecondo
  // sul database (vedi users.sessionVersion per quando cambia il numero).
  const [account] = await db
    .select({
      active:             users.active,
      role:               users.role,
      sessionVersion:     users.sessionVersion,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  // Un cookie aperto prima che esistesse il numero di versione vale 0: così al
  // momento della pubblicazione nessuno viene buttato fuori.
  if (!account || !account.active || account.sessionVersion !== (user.sessionVersion ?? 0)) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Sessione non più valida' })
  }

  // Da qui in poi contano i valori del DATABASE, non quelli scritti nel cookie al login.
  // Controllo ruolo in base alla policy (metodo HTTP incluso: le scritture possono richiedere ruoli più alti)
  const allowed = allowedRolesFor(path, event.method)
  if (!allowed.includes(account.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso non consentito per il tuo ruolo' })
  }

  // Password temporanea: tutto bloccato tranne gli endpoint auth (cambio password, logout)
  if (account.mustChangePassword && !path.startsWith('/api/auth/')) {
    throw createError({ statusCode: 403, statusMessage: 'Cambio password obbligatorio' })
  }

  // Genitore/studente che non ha ancora accettato i documenti legali: API del portale bloccate
  if (['GENITORE', 'STUDENTE'].includes(account.role) && user.termsAccepted === false && path.startsWith('/api/portal')) {
    throw createError({ statusCode: 403, statusMessage: 'Accettazione dei documenti richiesta' })
  }
})
