import { db } from '../../../database/client'
import { lessons } from '../../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo admin e super tutor possono confermare la visione' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID lezione mancante' })
  }

  const [updated] = await db.update(lessons)
    .set({
      confermata: true,
      confermataDa: user.id,
      confermataAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(lessons.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Lezione non trovata' })
  }

  return updated
})
