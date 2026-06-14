import { z } from 'zod'
import { db } from '../../../database/client'
import { tutorAvailabilities } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'

const toggleSchema = z.object({
  date: z.string()
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readValidatedBody(event, toggleSchema.parse)
  const targetDate = new Date(body.date)
  // Assicuriamoci che l'ora sia azzerata per evitare duplicati sulla stessa giornata
  targetDate.setHours(0, 0, 0, 0)

  const existing = await db.query.tutorAvailabilities.findFirst({
    where: and(
      eq(tutorAvailabilities.userId, user.id),
      eq(tutorAvailabilities.date, targetDate)
    )
  })

  if (existing) {
    await db.delete(tutorAvailabilities).where(eq(tutorAvailabilities.id, existing.id))
    return { status: 'removed' }
  } else {
    await db.insert(tutorAvailabilities).values({
      userId: user.id,
      date: targetDate
    })
    return { status: 'added' }
  }
})
