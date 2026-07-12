import { z } from 'zod'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../../database/client'
import { users } from '../../database/schema'
import { nomeProprio } from '../../utils/nomi'

const UpdateProfileSchema = z.object({
  firstName:       z.string().min(1).max(100).optional(),
  lastName:        z.string().min(1).max(100).optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword:     z.string().min(8).max(100).optional(),
})

// PUT /api/portal/profile
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato ai genitori' })
  }

  const body = await readBody(event)
  const result = UpdateProfileSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  const data = result.data
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (data.firstName) updates.firstName = nomeProprio(data.firstName)
  if (data.lastName) updates.lastName = nomeProprio(data.lastName)

  if (data.newPassword) {
    if (!data.currentPassword) {
      throw createError({ statusCode: 400, statusMessage: 'Inserisci la password attuale per cambiarla' })
    }
    const dbUser = await db.query.users.findFirst({ where: eq(users.id, user.id) })
    if (!dbUser) throw createError({ statusCode: 404, statusMessage: 'Account non trovato' })

    const valid = await bcrypt.compare(data.currentPassword, dbUser.password)
    if (!valid) throw createError({ statusCode: 401, statusMessage: 'Password attuale non corretta' })

    updates.password = await bcrypt.hash(data.newPassword, 10)
    updates.mustChangePassword = false // cambio volontario: il gate non serve più
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, user.id)).returning()
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Account non trovato' })

  if (data.newPassword) {
    await setUserSession(event, { user: { ...user, mustChangePassword: false } })
  }
  return { ok: true, firstName: updated.firstName, lastName: updated.lastName }
})
