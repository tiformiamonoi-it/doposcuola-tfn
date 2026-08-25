import { db } from '../../../database/client'
import { lessons, bookings, tutorAvailabilities } from '../../../database/schema'
import { and, eq, gte, lte, ne, sql } from 'drizzle-orm'

// GET /api/settings/closures/impact?date=YYYY-MM-DD
// Che cosa "vive" in quella data: serve a mostrare le conseguenze PRIMA di aggiungere
// o togliere una chiusura, invece di scoprirle dopo.
export default defineEventHandler(async (event) => {
  const date = String(getQuery(event).date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Data non valida (formato richiesto: YYYY-MM-DD)' })
  }

  // Le prenotazioni sono timestamp: stesso range UTC usato dallo smistamento giornaliero
  const dayStart = new Date(`${date}T00:00:00.000Z`)
  const dayEnd   = new Date(`${date}T23:59:59.999Z`)

  const conta = sql<number>`count(*)::int`

  const [lezioni, prenotazioni, disponibilita] = await Promise.all([
    db.select({ n: conta }).from(lessons).where(eq(lessons.data, date)),
    db.select({ n: conta }).from(bookings).where(and(
      gte(bookings.requestedDate, dayStart),
      lte(bookings.requestedDate, dayEnd),
      ne(bookings.status, 'CANCELLED'),
    )),
    db.select({ n: conta }).from(tutorAvailabilities).where(eq(tutorAvailabilities.date, date)),
  ])

  return {
    date,
    lezioni:       lezioni[0]?.n ?? 0,
    prenotazioni:  prenotazioni[0]?.n ?? 0,
    disponibilita: disponibilita[0]?.n ?? 0,
  }
})
