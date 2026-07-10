import { z } from 'zod'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../../database/client'
import { users } from '../../database/schema'
import { generateTempPassword } from '../../services/portal-user.service'
import { sendEmail, emailBenvenutoCredenziali } from '../../utils/email'
import { rateLimitExceeded } from '../../utils/rate-limit'

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
})

// POST /api/auth/forgot-password — PUBBLICO (in PUBLIC_API_PREFIXES).
// Risposta SEMPRE identica, che l'email esista o no: nessuna informazione
// su quali indirizzi sono registrati (anti user-enumeration).
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

  const rispostaGenerica = { ok: true, message: 'Se l\'email è registrata riceverai le istruzioni per accedere.' }

  const user = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email.toLowerCase()),
  })
  if (!user || !user.active) return rispostaGenerica

  const tempPassword = generateTempPassword()

  // Prima l'email, poi il DB: se l'invio fallisce la vecchia password resta valida
  // (altrimenti l'utente resterebbe chiuso fuori senza aver ricevuto nulla)
  const { sent } = await sendEmail({
    to: user.email,
    ...emailBenvenutoCredenziali({ nome: user.firstName, email: user.email, tempPassword }),
  })
  if (!sent) return rispostaGenerica

  await db.update(users)
    .set({
      password: await bcrypt.hash(tempPassword, 10),
      mustChangePassword: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  return rispostaGenerica
})
