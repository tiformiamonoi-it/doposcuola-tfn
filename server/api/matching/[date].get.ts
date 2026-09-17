import { eq, and, gte, lte, ne } from 'drizzle-orm'
import { db } from '../../database/client'
import * as tables from '../../database/schema'
import { giornoFeriale, tutorDUfficio } from '../../services/disponibilita-tutor.service'

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
    subjects: a.user.tutorProfile?.materie || [],
    // Ha una riga di disponibilità → l'admin può toglierla dal giorno
    rimovibile: true,
  }))

  // Tutor d'ufficio dal lunedì al venerdì, anche senza aver spuntato niente (salvo
  // chiusure del centro): i FORFAIT e i "sempre disponibili" senza assenza quel giorno.
  // La regola sta in disponibilita-tutor.service.ts, la stessa del calendario del tutor.
  if (giornoFeriale(targetDate)) {
    const chiusura = await db.query.closureDates.findFirst({
      where: eq(tables.closureDates.date, targetDate),
    })
    if (!chiusura) {
      for (const t of await tutorDUfficio(targetDate)) {
        if (!tutors.some(x => x.id === t.id)) {
          tutors.push({
            id: t.id,
            name: `${t.firstName} ${t.lastName}`,
            phone: t.phone,
            notes: '',
            subjects: t.materie || [],
            // Il sempre disponibile si toglie dal giorno (diventa un'assenza);
            // il FORFAIT no: col fisso mensile lun-ven c'è sempre.
            rimovibile: !t.forfait,
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
        // Serve alla pagina per riconoscere lo stesso alunno (N4, regola in shared/matching.ts)
        studentId: b.studentId,
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
