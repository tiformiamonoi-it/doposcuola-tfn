import { z } from 'zod'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../../database/client'
import { users } from '../../database/schema'
import { rateLimitExceeded } from '../../utils/rate-limit'
import { apriSessioneAccesso } from '../../utils/accesso'

const loginSchema = z.object({
  email:    z.string().email('Email non valida'),
  password: z.string().min(1, 'Password obbligatoria'),
  // Default true: i client vecchi (e la PWA già installata) restano collegati
  ricordami: z.boolean().optional().default(true),
})

export default defineEventHandler(async (event) => {
  // Anti brute-force: max 10 tentativi ogni 10 minuti per IP
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'sconosciuto'
  if (rateLimitExceeded(`login:${ip}`, 10)) {
    throw createError({ statusCode: 429, message: 'Troppi tentativi: riprova tra qualche minuto' })
  }

  const body = await readValidatedBody(event, loginSchema.parse)

  const user = await db.query.users.findFirst({
    where: eq(users.email, body.email.toLowerCase()),
  })

  // Messaggio generico — non rivela se l'email esiste o no
  if (!user || !user.active) {
    throw createError({ statusCode: 401, message: 'Credenziali non valide' })
  }

  const valid = await bcrypt.compare(body.password, user.password)
  if (!valid) {
    throw createError({ statusCode: 401, message: 'Credenziali non valide' })
  }

  // La sessione (figli collegati, documenti da accettare, dove andare) si prepara
  // in un posto solo: utils/accesso.ts. La usa anche il link "scegli la tua
  // password", così le due strade d'ingresso non possono divergere.
  const { redirectTo } = await apriSessioneAccesso(event, user, body.ricordami)

  return { ok: true, redirectTo }
})
