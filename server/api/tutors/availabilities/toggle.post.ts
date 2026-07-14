import { z } from 'zod'
import { db } from '../../../database/client'
import { tutorAvailabilities, closureDates, tutorProfiles } from '../../../database/schema'
import { eq, and, sql } from 'drizzle-orm'
import { oggiRomeStr, disponibilitaOggiAncoraAperta } from '../../../utils/tutor-time-window'

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
  // possono aggiungere/togliere disponibilità solo il sabato.
  if (giornoSettimana !== 6) {
    const [profilo] = await db.select({ modalitaPagamento: tutorProfiles.modalitaPagamento })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.userId, user.id))
      .limit(1)
    if (profilo?.modalitaPagamento === 'FORFAIT') {
      throw createError({ statusCode: 403, statusMessage: 'Con il fisso mensile sei sempre disponibile dal lunedì al venerdì: puoi modificare solo il sabato' })
    }
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
