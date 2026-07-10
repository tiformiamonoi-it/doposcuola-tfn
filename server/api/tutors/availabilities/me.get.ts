import { db } from '../../../database/client'
import { tutorAvailabilities, closureDates } from '../../../database/schema'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { oggiRomeStr, disponibilitaOggiAncoraAperta } from '../../../utils/tutor-time-window'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const query = getQuery(event)

  if (!query.from || !query.to) {
    throw createError({ statusCode: 400, message: 'Missing from or to parameters' })
  }

  const fromStr = String(query.from).slice(0, 10)
  const toStr   = String(query.to).slice(0, 10)

  const [disponibilita, chiusureRows] = await Promise.all([
    db.query.tutorAvailabilities.findMany({
      where: and(
        eq(tutorAvailabilities.userId, user.id),
        gte(tutorAvailabilities.date, fromStr),
        lte(tutorAvailabilities.date, toStr)
      ),
      columns: {
        id: true,
        date: true,
        notes: true
      }
    }),
    // Giorni di chiusura nel periodo (per bloccarli nel calendario disponibilità)
    db.select({ d: sql<string>`to_char(DATE(${closureDates.date}), 'YYYY-MM-DD')` })
      .from(closureDates)
      .where(sql`DATE(${closureDates.date}) BETWEEN ${fromStr} AND ${toStr}`),
  ])

  return {
    disponibilita,
    chiusure: chiusureRows.map((r) => r.d),
    // Calcolati sul server (ora italiana): il client non deve fidarsi dell'orologio del telefono
    oggi: oggiRomeStr(),
    oggiBloccato: !disponibilitaOggiAncoraAperta(),
  }
})
