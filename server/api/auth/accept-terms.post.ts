import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { users } from '../../database/schema'
import { TERMS_VERSION } from '#shared/legal'

const AcceptTermsSchema = z.object({
  version: z.string().min(1),
})

// POST /api/auth/accept-terms — solo GENITORE (policy in auth-policy.ts)
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  if (session.user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Riservato ai genitori' })
  }

  const body = await readBody(event)
  const result = AcceptTermsSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi' })
  }

  // La pagina mostrava una versione vecchia dei termini: ricaricare
  if (result.data.version !== TERMS_VERSION) {
    throw createError({ statusCode: 409, statusMessage: 'Versione dei termini non aggiornata: ricarica la pagina' })
  }

  await db.update(users)
    .set({ termsAcceptedAt: new Date(), termsAcceptedVersion: TERMS_VERSION, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  await setUserSession(event, { user: { ...session.user, termsAccepted: true } })

  return { ok: true }
})
