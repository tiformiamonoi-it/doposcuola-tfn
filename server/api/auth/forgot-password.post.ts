import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { users } from '../../database/schema'
import { sendEmail, emailInvitoPassword } from '../../utils/email'
import { creaLinkPassword } from '../../utils/password-token'
import { rateLimitExceeded } from '../../utils/rate-limit'

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
})

// POST /api/auth/forgot-password — PUBBLICO (in PUBLIC_API_PREFIXES).
// Risposta SEMPRE identica, che l'email esista o no: nessuna informazione
// su quali indirizzi sono registrati (anti user-enumeration).
//
// IMPORTANTE — cosa è cambiato: prima questo endpoint CAMBIAVA d'ufficio la
// password dell'utente e gliela spediva. Significava che chiunque conoscesse
// l'email di un genitore poteva buttarlo fuori dal suo account senza sapere
// nulla. Ora l'account non viene toccato: si crea solo un link monouso e a
// tempo. Chi non lo apre continua a entrare con la password di sempre.
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'sconosciuto'
  if (rateLimitExceeded(`forgot:${ip}`)) {
    throw createError({ statusCode: 429, statusMessage: 'Troppi tentativi: riprova tra qualche minuto' })
  }

  const body = await readBody(event)
  const parsed = ForgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Email non valida' })
  }
  const email = parsed.data.email.toLowerCase()

  // Secondo limite, per indirizzo destinatario (3 all'ora): il limite per IP si
  // aggira cambiando IP, e senza questo la casella di una famiglia si potrebbe
  // inondare di email (e la quota Brevo esaurire). Vale per qualsiasi indirizzo,
  // registrato o no, quindi non rivela chi è iscritto.
  if (rateLimitExceeded(`forgot-email:${email}`, 3, 60 * 60 * 1000)) {
    throw createError({ statusCode: 429, statusMessage: 'Troppi tentativi per questo indirizzo: riprova tra un\'ora' })
  }

  const rispostaGenerica = { ok: true, message: 'Se l\'email è registrata riceverai un link per scegliere una nuova password.' }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, email: true, firstName: true, lastName: true, active: true },
  })
  if (!user || !user.active) return rispostaGenerica

  // Scopo RECUPERO: finestra stretta (2 ore), perché è una richiesta fatta
  // adesso da chi sta davanti allo schermo, non un invito spedito dalla segreteria.
  const { link } = await creaLinkPassword(user.id, 'RECUPERO')

  await sendEmail({
    to: user.email,
    tipo: 'RECUPERO_PASSWORD',
    nomeDestinatario: `${user.firstName} ${user.lastName}`,
    ...emailInvitoPassword({ nome: user.firstName, link, scopo: 'RECUPERO' }),
  })

  // Anche se l'invio fallisce la risposta resta identica: il link non si
  // restituisce mai al browser (chiunque potrebbe chiederlo per un'email altrui).
  return rispostaGenerica
})
