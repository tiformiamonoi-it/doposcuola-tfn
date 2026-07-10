import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { users } from '../../database/schema'

// POST /api/auth/tutorial-visto — segna il tutorial di benvenuto come visto
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  await db.update(users)
    .set({ tutorialVisto: true, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  await setUserSession(event, { user: { ...session.user, tutorialVisto: true } })

  return { ok: true }
})
