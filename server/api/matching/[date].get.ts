import { eq, and, gte, lte, ne } from 'drizzle-orm'
import { startOfDay, endOfDay } from 'date-fns'
import { db } from '../../database/client'
import * as tables from '../../database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') throw createError({ statusCode: 403, message: 'Forbidden' })

  const dateParam = getRouterParam(event, 'date')
  if (!dateParam) throw createError({ statusCode: 400, message: 'Data mancante' })

  const targetDate = new Date(dateParam)
  if (isNaN(targetDate.getTime())) {
    throw createError({ statusCode: 400, message: 'Data non valida' })
  }

  const start = startOfDay(targetDate)
  const end = endOfDay(targetDate)

  // 1. Troviamo i Tutor Disponibili per questo giorno
  const availabilities = await db.query.tutorAvailabilities.findMany({
    where: and(
      gte(tables.tutorAvailabilities.date, start),
      lte(tables.tutorAvailabilities.date, end)
    ),
    with: {
      user: {
        columns: { id: true, firstName: true, lastName: true, phone: true },
        with: {
          tutorProfile: true
        }
      }
    }
  })

  const tutors = availabilities.map(a => ({
    id: a.user.id,
    name: `${a.user.firstName} ${a.user.lastName}`,
    phone: a.user.phone,
    notes: a.notes || '',
    subjects: a.user.tutorProfile?.materie || []
  }))

  // 2. Troviamo le Prenotazioni (Bookings) per questo giorno
  const dayBookings = await db.query.bookings.findMany({
    where: and(
      gte(tables.bookings.requestedDate, start),
      lte(tables.bookings.requestedDate, end),
      ne(tables.bookings.status, 'CANCELLED')
    ),
    with: {
      subjects: {
        with: {
          assignedTutor: {
            columns: { id: true, firstName: true, lastName: true }
          }
        }
      }
    }
  })

  // Formattiamo le prenotazioni in "Badges" come nel .old
  const badges: any[] = []
  dayBookings.forEach(b => {
    b.subjects.forEach(subjectRel => {
      badges.push({
        subjectId: subjectRel.id,
        bookingId: b.id,
        studentName: b.studentName,
        studentSurname: b.studentSurname,
        studentPhone: b.studentPhone,
        subject: subjectRel.name,
        notes: b.notes,
        assignedTutorId: subjectRel.assignedTutorId,
        assignedSlot: subjectRel.assignedSlot,
        isAssigned: !!subjectRel.assignedTutorId && !!subjectRel.assignedSlot
      })
    })
  })

  // 3. Slot orari reali dal database (ordinati per ora inizio)
  const timeSlotsList = await db.query.timeSlots.findMany({
    orderBy: (ts, { asc }) => [asc(ts.oraInizio)]
  })

  const slots = timeSlotsList.map(ts => ({
    id: `${ts.oraInizio}-${ts.oraFine}`,
    label: `${ts.oraInizio} - ${ts.oraFine}`
  }))

  return {
    date: dateParam,
    tutors,
    badges,
    slots
  }
})
