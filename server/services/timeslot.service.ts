import { db } from '../database/client'
import { timeSlots, lessons, systemConfigs } from '../database/schema'
import { eq, asc, sql } from 'drizzle-orm'
import type { CreateTimeSlotInput, UpdateTimeSlotInput } from '#shared/schemas/timeslot.schema'

// Chiave system_configs con gli id degli slot sempre mostrati nel calendario
// (gli altri compaiono solo nei giorni in cui hanno lezioni).
const CHIAVE_SEMPRE_VISIBILI = 'slot_sempre_visibili'

// null = chiave mai salvata: vale "tutti gli slot attivi sempre visibili".
async function leggiSempreVisibili(): Promise<string[] | null> {
  const [row] = await db.select({ value: systemConfigs.value }).from(systemConfigs)
    .where(eq(systemConfigs.key, CHIAVE_SEMPRE_VISIBILI)).limit(1)
  if (!row) return null
  try { return JSON.parse(row.value) } catch { return null }
}

export async function listTimeSlots(activeOnly = false) {
  const query = db.select().from(timeSlots).orderBy(asc(timeSlots.oraInizio))
  if (activeOnly) {
    query.where(eq(timeSlots.active, true))
  }
  const [slots, sempre] = await Promise.all([query, leggiSempreVisibili()])
  return slots.map(s => ({ ...s, sempreVisibile: s.active && (sempre ? sempre.includes(s.id) : true) }))
}

export async function setSlotSempreVisibile(id: string, visibile: boolean) {
  // Primo salvataggio: si parte da tutti gli slot attivi, poi si applica la scelta
  let ids = await leggiSempreVisibili()
  if (!ids) {
    ids = (await db.select({ id: timeSlots.id }).from(timeSlots).where(eq(timeSlots.active, true))).map(s => s.id)
  }
  const set = new Set(ids)
  if (visibile) set.add(id)
  else set.delete(id)
  const value = JSON.stringify([...set])
  await db.insert(systemConfigs).values({ key: CHIAVE_SEMPRE_VISIBILI, value })
    .onConflictDoUpdate({ target: systemConfigs.key, set: { value, updatedAt: new Date() } })
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
