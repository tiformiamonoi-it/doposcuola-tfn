import { db } from '../../../database/client'
import { tutorAvailabilities } from '../../../database/schema'
import { eq, and, gte, lte } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const query = getQuery(event)
  
  if (!query.from || !query.to) {
    throw createError({ statusCode: 400, message: 'Missing from or to parameters' })
  }

  const from = new Date(query.from as string)
  const to = new Date(query.to as string)

  const data = await db.query.tutorAvailabilities.findMany({
    where: and(
      eq(tutorAvailabilities.userId, user.id),
      gte(tutorAvailabilities.date, from),
      lte(tutorAvailabilities.date, to)
    ),
    columns: {
      id: true,
      date: true,
      notes: true
    }
  })

  return data
})
