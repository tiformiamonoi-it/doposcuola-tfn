import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../../database/client'
import { tutorAvailabilities } from '../../database/schema'

const schema = z.object({
  tutorId:  z.string().min(1),
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida'),
  presente: z.boolean(),
})

// POST /api/matching/tutor-availability
// L'amministrazione forza (o toglie) la disponibilità di un tutor per un giorno,
// esattamente come se l'avesse spuntata lui dall'area tutor.
// ponytail: riusa la tabella disponibilità invece di un flag "forzato" a parte,
// così matching, stampa e conteggi funzionano già senza altre modifiche.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'Riservato ad admin e super tutor' })
  }

  const { tutorId, date, presente } = await readValidatedBody(event, schema.parse)

  if (presente) {
    await db.insert(tutorAvailabilities)
      .values({ userId: tutorId, date, notes: 'Aggiunto dall’amministrazione' })
      .onConflictDoNothing()
    return { status: 'added' }
  }

  await db.delete(tutorAvailabilities).where(and(
    eq(tutorAvailabilities.userId, tutorId),
    eq(tutorAvailabilities.date, date),
  ))
  return { status: 'removed' }
})
