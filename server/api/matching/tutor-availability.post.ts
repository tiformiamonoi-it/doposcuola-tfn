import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../../database/client'
import { tutorAvailabilities, tutorAssenze, closureDates } from '../../database/schema'
import { giornoFeriale, regolaFerialeDelTutor } from '../../services/disponibilita-tutor.service'

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

  // Tutor "sempre disponibile" (non FORFAIT) in un giorno feriale: c'è d'ufficio, quindi
  // toglierlo vuol dire segnargli l'ASSENZA, e rimetterlo vuol dire cancellarla —
  // come se l'avesse toccato lui nel suo calendario. Resta scritto chi l'ha fatto.
  // Nei giorni di chiusura d'ufficio non c'è nessuno: lì vale la spunta, come per tutti.
  if (
    giornoFeriale(date)
    && await regolaFerialeDelTutor(tutorId) === 'SEMPRE_DISPONIBILE'
    && !await db.query.closureDates.findFirst({ where: eq(closureDates.date, date) })
  ) {
    if (presente) {
      await db.delete(tutorAssenze).where(and(eq(tutorAssenze.userId, tutorId), eq(tutorAssenze.date, date)))
      return { status: 'added' }
    }
    await db.insert(tutorAssenze)
      .values({ userId: tutorId, date, createdByUserId: user.id })
      .onConflictDoNothing()
    // Un'eventuale spunta di quel giorno lo farebbe ricomparire: via anche quella
    await db.delete(tutorAvailabilities).where(and(
      eq(tutorAvailabilities.userId, tutorId),
      eq(tutorAvailabilities.date, date),
    ))
    return { status: 'removed' }
  }

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
