import { db } from '../../../database/client'
import { systemConfigs } from '../../../database/schema'
import { eq } from 'drizzle-orm'
import { UpdateConfigsSchema } from '../../../../shared/schemas/settings.schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN') throw createError({ statusCode: 403, message: 'Forbidden' })

  const body = await readBody(event)
  const parsed = UpdateConfigsSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati configurazione non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const data = parsed.data
  const results = []
  
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'string') continue
      
      const existing = await tx.select().from(systemConfigs).where(eq(systemConfigs.key, key)).limit(1)
      if (existing.length > 0) {
        const [updated] = await tx.update(systemConfigs).set({ value, updatedAt: new Date() }).where(eq(systemConfigs.key, key)).returning()
        results.push(updated)
      } else {
        const [inserted] = await tx.insert(systemConfigs).values({ key, value }).returning()
        results.push(inserted)
      }
    }
  })

  return { success: true }
})
