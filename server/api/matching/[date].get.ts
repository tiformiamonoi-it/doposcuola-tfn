import { eq, and, gte, lte, ne } from 'drizzle-orm'
import { db } from '../../database/client'
import * as tables from '../../database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') throw createError({ statusCode: 403, message: 'Forbidden' })

  const dateParam = getRouterParam(event, 'date')
  if (!dateParam) throw createError({ statusCode: 400, message: 'Data mancante' })

  const targetDate = dateParam.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw createError({ statusCode: 400, message: 'Data non valida (formato richiesto: YYYY-MM-DD)' })
  }

  // 1. Troviamo i Tutor Disponibili per questo giorno
  const availabilities = await db.query.tutorAvailabilities.findMany({
    where: eq(tables.tutorAvailabilities.date, targetDate),
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

  // Tutor a fisso mensile (FORFAIT): sempre disponibili dal lunedì al venerdì,
  // anche senza aver spuntato la disponibilità (salvo chiusure del centro).
  const giornoSettimana = new Date(`${targetDate}T00:00:00Z`).getUTCDay()
  if (giornoSettimana >= 1 && giornoSettimana <= 5) {
    const chiusura = await db.query.closureDates.findFirst({
      where: eq(tables.closureDates.date, targetDate),
    })
    if (!chiusura) {
      const forfaitTutors = await db
        .select({
          id:        tables.users.id,
          firstName: tables.users.firstName,
          lastName:  tables.users.lastName,
          phone:     tables.users.phone,
          materie:   tables.tutorProfiles.materie,
        })
        .from(tables.users)
        .innerJoin(tables.tutorProfiles, eq(tables.tutorProfiles.userId, tables.users.id))
        .where(and(
          eq(tables.users.active, true),
          eq(tables.tutorProfiles.modalitaPagamento, 'FORFAIT'),
        ))

      for (const t of forfaitTutors) {
        if (!tutors.some(x => x.id === t.id)) {
          tutors.push({
            id: t.id,
            name: `${t.firstName} ${t.lastName}`,
            phone: t.phone,
            notes: '',
            subjects: t.materie || [],
          })
        }
      }
    }
  }

  // 2. Troviamo le Prenotazioni (Bookings) per questo giorno
  // Le date delle prenotazioni sono timestamp: usiamo il range del giorno in UTC
  // per evitare slittamenti di fuso orario (la data inserita è già YYYY-MM-DD).
  const dayStart = new Date(`${targetDate}T00:00:00.000Z`)
  const dayEnd   = new Date(`${targetDate}T23:59:59.999Z`)
  const dayBookings = await db.query.bookings.findMany({
    where: and(
      gte(tables.bookings.requestedDate, dayStart),
      lte(tables.bookings.requestedDate, dayEnd),
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
        isAssigned: !!subjectRel.assignedTutorId && !!subjectRel.assignedSlot,
        // Lezione speciale fuori data: supplemento €10 da approvare (o già applicato)
        supplemento: b.supplemento ? parseFloat(b.supplemento) : 0,
        supplementoApplicato: !!b.supplementoApplicatoAt,
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
