import { db } from '../database/client'
import { timeSlots, lessons } from '../database/schema'
import { eq, asc, sql } from 'drizzle-orm'
import type { CreateTimeSlotInput, UpdateTimeSlotInput } from '#shared/schemas/timeslot.schema'

export async function listTimeSlots(activeOnly = false) {
  const query = db.select().from(timeSlots).orderBy(asc(timeSlots.oraInizio))
  if (activeOnly) {
    query.where(eq(timeSlots.active, true))
  }
  return query
}

export async function createTimeSlot(data: CreateTimeSlotInput) {
  const [created] = await db.insert(timeSlots).values(data).returning()
  return created
}

export async function updateTimeSlot(id: string, data: UpdateTimeSlotInput) {
  const [updated] = await db.update(timeSlots)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(timeSlots.id, id))
    .returning()
  return updated
}

export async function deleteTimeSlot(id: string) {
  const [inUse] = await db.select({ count: sql<number>`count(*)::int` })
    .from(lessons)
    .where(eq(lessons.timeSlotId, id))
    
  if (inUse && inUse.count > 0) {
    throw new Error('Impossibile eliminare lo slot: ha lezioni associate. Puoi solo disattivarlo.')
  }

  const [deleted] = await db.delete(timeSlots).where(eq(timeSlots.id, id)).returning()
  return deleted
}
