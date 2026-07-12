import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import * as tables from '../../database/schema'
import { AssignTutorSlotSchema } from '#shared/schemas/matching.schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') throw createError({ statusCode: 403, message: 'Forbidden' })

  const body = await readBody(event)
  const parsed = AssignTutorSlotSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati assegnazione non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const { subjectId, tutorId, slot } = parsed.data

  // Se tutorId e slot sono null, rimuove assegnazione
  const updateData = {
    assignedTutorId: tutorId || null,
    assignedSlot: slot || null,
    assignedAt: tutorId && slot ? new Date() : null
  }

  const [subject] = await db.update(tables.bookingSubjects)
    .set(updateData)
    .where(eq(tables.bookingSubjects.id, subjectId))
    .returning()

  return {
    message: tutorId ? 'Assegnazione salvata' : 'Assegnazione rimossa',
    subject
  }
})
