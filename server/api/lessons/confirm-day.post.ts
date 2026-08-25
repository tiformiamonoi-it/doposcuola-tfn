import { and, eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { lessons } from '../../database/schema'
import { ConfirmLessonsDaySchema } from '#shared/schemas/lesson.schema'

// POST /api/lessons/confirm-day
// Conferma in un colpo solo la visione di TUTTE le lezioni di un giorno (tutti gli slot
// orari, tutti i tutor). Con `tutorId` si limita a un solo tutor: serve quando il
// calendario è filtrato, così si approva esattamente ciò che è a schermo.
//
// La policy su /api/lessons apre l'accesso anche ai TUTOR: il controllo di ruolo va
// quindi rifatto QUI, come già fa /api/lessons/:id/confirm.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo admin e super tutor possono confermare la visione' })
  }

  const parsed = ConfirmLessonsDaySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati di approvazione non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const { data, tutorId } = parsed.data

  // Solo le lezioni ancora da confermare: chi ha già firmato prima resta l'autore
  // della conferma (confermataDa non viene sovrascritto).
  const filtri = [
    eq(lessons.data, data),
    eq(lessons.confermata, false),
    ...(tutorId ? [eq(lessons.tutorId, tutorId)] : []),
  ]

  const confermate = await db.update(lessons)
    .set({
      confermata: true,
      confermataDa: user.id,
      confermataAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(...filtri))
    .returning({ id: lessons.id })

  return { confermate: confermate.length, data, tutorId: tutorId ?? null }
})
