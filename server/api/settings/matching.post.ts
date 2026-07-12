import { db } from '../../database/client'
import { systemConfigs } from '../../database/schema'
import { eq } from 'drizzle-orm'
import { SaveMatchingSchema } from '#shared/schemas/settings.schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') throw createError({ statusCode: 403, message: 'Forbidden' })
  
  const body = await readBody(event)
  const parsed = SaveMatchingSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati matching non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const jsonStr = JSON.stringify(parsed.data.matching || [])

  const existing = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, 'daily_matching_state')
  })

  if (existing) {
    await db.update(systemConfigs)
      .set({ value: jsonStr, updatedAt: new Date() })
      .where(eq(systemConfigs.id, existing.id))
  } else {
    await db.insert(systemConfigs).values({
      key: 'daily_matching_state',
      value: jsonStr,
      category: 'matching',
      description: 'Salvataggio temporaneo del matching odierno'
    })
  }

  return { success: true }
})
