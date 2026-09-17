import { z } from 'zod'
import { db } from '../../../database/client'
import { tutorAvailabilities, closureDates, tutorAssenze } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'
import { oggiRomeStr, disponibilitaOggiAncoraAperta } from '../../../utils/tutor-time-window'
import { regolaFerialeDelTutor } from '../../../services/disponibilita-tutor.service'

const toggleSchema = z.object({
  date: z.string()
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readValidatedBody(event, toggleSchema.parse)
  const dateStr = body.date.slice(0, 10) // 'YYYY-MM-DD'

  // Regole (validate qui, non solo nella UI): niente giorni passati,
  // oggi solo entro le 9:30 (ora italiana), mai domenica, mai giorni di chiusura
  const oggi = oggiRomeStr()
  if (dateStr < oggi) {
    throw createError({ statusCode: 403, statusMessage: 'Non puoi modificare le disponibilità dei giorni passati' })
  }
  if (dateStr === oggi && !disponibilitaOggiAncoraAperta()) {
    throw createError({ statusCode: 403, statusMessage: 'La disponibilità di oggi si può modificare solo entro le 9:30' })
  }
  const giornoSettimana = new Date(dateStr + 'T00:00:00Z').getUTCDay()
  if (giornoSettimana === 0) {
    throw createError({ statusCode: 403, statusMessage: 'La domenica il centro è chiuso' })
  }

  // Tutor a fisso mensile (FORFAIT): lun-ven sono sempre disponibili d'ufficio,
  // possono aggiungere/togliere disponibilità solo il sabato. Il sabato vale per tutti
  // la spunta, quindi la regola del tutor serve solo nei giorni feriali.
  const regola = giornoSettimana !== 6 ? await regolaFerialeDelTutor(user.id) : 'A_SPUNTA'
  if (regola === 'FORFAIT') {
    throw createError({ statusCode: 403, statusMessage: 'Con il fisso mensile sei sempre disponibile dal lunedì al venerdì: puoi modificare solo il sabato' })
  }
  const chiusura = await db.query.closureDates.findFirst({
    where: eq(closureDates.date, dateStr),
  })
  if (chiusura) {
    throw createError({ statusCode: 403, statusMessage: `Giorno di chiusura${chiusura.description ? ` (${chiusura.description})` : ''}` })
  }

  const existing = await db.query.tutorAvailabilities.findFirst({
    where: and(
      eq(tutorAvailabilities.userId, user.id),
      eq(tutorAvailabilities.date, dateStr)
    )
  })

  // Sempre disponibile, giorno feriale: il tocco segna o toglie l'ASSENZA.
  // Quel giorno c'è se non ha l'assenza, oppure se l'aveva anche spuntato
  // (spunta rimasta da quando l'interruttore era spento): in quel caso il tocco lo
  // rende assente davvero, togliendo anche la spunta.
  if (regola === 'SEMPRE_DISPONIBILE') {
    const assenza = await db.query.tutorAssenze.findFirst({
      where: and(eq(tutorAssenze.userId, user.id), eq(tutorAssenze.date, dateStr)),
    })
    if (assenza && !existing) {
      await db.delete(tutorAssenze).where(eq(tutorAssenze.id, assenza.id))
      return { status: 'added' }
    }
    await db.insert(tutorAssenze)
      .values({ userId: user.id, date: dateStr, createdByUserId: user.id })
      .onConflictDoNothing()
    if (existing) await db.delete(tutorAvailabilities).where(eq(tutorAvailabilities.id, existing.id))
    return { status: 'removed' }
  }

  if (existing) {
    await db.delete(tutorAvailabilities).where(eq(tutorAvailabilities.id, existing.id))
    return { status: 'removed' }
  } else {
    await db.insert(tutorAvailabilities).values({
      userId: user.id,
      date: dateStr
    })
    return { status: 'added' }
  }
})
