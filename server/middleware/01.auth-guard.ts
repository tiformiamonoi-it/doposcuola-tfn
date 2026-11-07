import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { users } from '../database/schema'
import { timingSafeEqual } from 'node:crypto'
import { isPublicApi, allowedRolesFor } from '../utils/auth-policy'
import { terminiAccettati } from '#shared/legal'

// "Authorization: Bearer $CRON_SECRET" è quello che Vercel manda ai suoi cron.
// Confronto a tempo costante: la durata della risposta non deve dire quanti
// caratteri del segreto sono giusti.
function cronAutorizzato(auth: string | undefined): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !auth) return false
  const atteso = Buffer.from(`Bearer ${secret}`)
  const ricevuto = Buffer.from(auth)
  return atteso.length === ricevuto.length && timingSafeEqual(atteso, ricevuto)
}

// Guardia globale: ogni route /api/** richiede login + ruolo ammesso.
// Eccezioni: login e endpoint di sessione (PUBLIC_API_PREFIXES).
export default defineEventHandler(async (event) => {
  const path = event.path || ''

  // Solo le API sono protette qui (le pagine hanno i middleware Nuxt lato client)
  if (!path.startsWith('/api/')) return

  // I CRON non hanno una sessione (li chiama Vercel, non una persona) ma non sono
  // pubblici: il segreto si controlla QUI, una volta per tutti i file di
  // /api/_cron/, anche quelli che si aggiungeranno. Prima ogni cron aveva la sua
  // copia del controllo, e uno nuovo senza la copia sarebbe nato aperto a chiunque.
  if (path.startsWith('/api/_cron/')) {
    if (!import.meta.dev && !cronAutorizzato(getHeader(event, 'authorization'))) {
      throw createError({ statusCode: 401, statusMessage: 'Non autorizzato' })
    }
    return
  }

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
      termsAcceptedVersion: users.termsAcceptedVersion,
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
  // La versione accettata si legge dal DATABASE: il "sì" scritto nel cookie al login
  // resterebbe valido fino a 30 giorni anche dopo l'uscita di termini nuovi.
  if (path.startsWith('/api/portal') && !terminiAccettati(account.role, account.termsAcceptedVersion)) {
    throw createError({ statusCode: 403, statusMessage: 'Accettazione dei documenti richiesta' })
  }
})
