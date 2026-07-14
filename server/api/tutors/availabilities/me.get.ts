import { db } from '../../../database/client'
import { tutorAvailabilities, closureDates, tutorProfiles } from '../../../database/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { oggiRomeStr, disponibilitaOggiAncoraAperta } from '../../../utils/tutor-time-window'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const query = getQuery(event)

  if (!query.from || !query.to) {
    throw createError({ statusCode: 400, message: 'Missing from or to parameters' })
  }

  const fromStr = String(query.from).slice(0, 10)
  const toStr   = String(query.to).slice(0, 10)

  const [disponibilita, chiusureRows, [profilo]] = await Promise.all([
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
    // Giorni di chiusura nel periodo (colonna date 'YYYY-MM-DD': confronto diretto)
    db.select({ d: closureDates.date })
      .from(closureDates)
      .where(and(gte(closureDates.date, fromStr), lte(closureDates.date, toStr))),
    db.select({ modalitaPagamento: tutorProfiles.modalitaPagamento })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.userId, user.id))
      .limit(1),
  ])

  return {
    disponibilita,
    chiusure: chiusureRows.map((r) => r.d),
    // Fisso mensile: lun-ven sempre disponibile d'ufficio (il calendario li mostra bloccati)
    forfait: profilo?.modalitaPagamento === 'FORFAIT',
    // Calcolati sul server (ora italiana): il client non deve fidarsi dell'orologio del telefono
    oggi: oggiRomeStr(),
    oggiBloccato: !disponibilitaOggiAncoraAperta(),
  }
})
