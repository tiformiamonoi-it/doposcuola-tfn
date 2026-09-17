import { db } from '../../../database/client'
import { tutorAvailabilities, closureDates, tutorAssenze } from '../../../database/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { oggiRomeStr, disponibilitaOggiAncoraAperta } from '../../../utils/tutor-time-window'
import { regolaFerialeDelTutor } from '../../../services/disponibilita-tutor.service'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const query = getQuery(event)

  if (!query.from || !query.to) {
    throw createError({ statusCode: 400, message: 'Missing from or to parameters' })
  }

  const fromStr = String(query.from).slice(0, 10)
  const toStr   = String(query.to).slice(0, 10)

  const [disponibilita, chiusureRows, regola, assenzeRows] = await Promise.all([
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
    regolaFerialeDelTutor(user.id),
    // Giorni segnati "non ci sono" (contano solo per i sempre disponibili)
    db.select({ d: tutorAssenze.date })
      .from(tutorAssenze)
      .where(and(eq(tutorAssenze.userId, user.id), gte(tutorAssenze.date, fromStr), lte(tutorAssenze.date, toStr))),
  ])

  return {
    disponibilita,
    chiusure: chiusureRows.map((r) => r.d),
    // Fisso mensile: lun-ven sempre disponibile d'ufficio (il calendario li mostra bloccati)
    forfait: regola === 'FORFAIT',
    // Sempre disponibile (e non FORFAIT): lun-ven c'è, tranne i giorni in `assenze`
    sempreDisponibile: regola === 'SEMPRE_DISPONIBILE',
    // A interruttore spento le assenze restano a database ma non valgono più: non si mandano
    assenze: regola === 'SEMPRE_DISPONIBILE' ? assenzeRows.map((r) => r.d) : [],
    // Calcolati sul server (ora italiana): il client non deve fidarsi dell'orologio del telefono
    oggi: oggiRomeStr(),
    oggiBloccato: !disponibilitaOggiAncoraAperta(),
  }
})
