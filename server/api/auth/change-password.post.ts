import { z } from 'zod'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../../database/client'
import { users } from '../../database/schema'
import { NuovaPasswordSchema } from '#shared/schemas/password.schema'

// Le regole della password stanno in un posto solo: le stesse valgono qui e
// nella pagina pubblica "scegli la tua password". Se divergessero, un utente
// potrebbe impostare da un link una password che poi il cambio password rifiuta.
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password attuale obbligatoria'),
  newPassword:     NuovaPasswordSchema,
})

// POST /api/auth/change-password — tutti i ruoli loggati
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const body = await readBody(event)
  const result = ChangePasswordSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  const dbUser = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
  if (!dbUser) throw createError({ statusCode: 404, statusMessage: 'Account non trovato' })

  const valid = await bcrypt.compare(result.data.currentPassword, dbUser.password)
  if (!valid) throw createError({ statusCode: 401, statusMessage: 'Password attuale non corretta' })

  const hashed = await bcrypt.hash(result.data.newPassword, 10)
  await db.update(users)
    .set({ password: hashed, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  // Aggiorna la sessione: il gate non deve più scattare
  await salvaSessioneUtente(event, { ...session.user, mustChangePassword: false })

  return { ok: true }
})
