import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { users } from '../../database/schema'
import { TERMS_VERSION, PRIVACY_STUDENTE_VERSION } from '#shared/legal'

const AcceptTermsSchema = z.object({
  version: z.string().min(1),
})

// POST /api/auth/accept-terms — GENITORE (termini+privacy) e STUDENTE (privacy studente)
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  if (!['GENITORE', 'STUDENTE'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Riservato a genitori e studenti' })
  }

  const body = await readBody(event)
  const result = AcceptTermsSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi' })
  }

  // La pagina mostrava una versione vecchia dei documenti: ricaricare
  const versioneAttesa = session.user.role === 'GENITORE' ? TERMS_VERSION : PRIVACY_STUDENTE_VERSION
  if (result.data.version !== versioneAttesa) {
    throw createError({ statusCode: 409, statusMessage: 'Versione dei documenti non aggiornata: ricarica la pagina' })
  }

  await db.update(users)
    .set({ termsAcceptedAt: new Date(), termsAcceptedVersion: versioneAttesa, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  await setUserSession(event, { user: { ...session.user, termsAccepted: true } })

  return { ok: true }
})
