import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { bookings, bookingSubjects, students, closureDates } from '../database/schema'
import type { CreateBookingInput, UpdateBookingStatusInput } from '#shared/schemas/booking.schema'

// Crea una prenotazione dal portale famiglie
export async function createBooking(input: CreateBookingInput, userId: string) {
  const student = await db.query.students.findFirst({
    where: eq(students.id, input.studentId),
    columns: { firstName: true, lastName: true, studentPhone: true }
  })

  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Studente non trovato' })
  }

  const dateObj = new Date(input.dataDesiderata)
  
  // 1. Controllo Domenica (0 = Domenica)
  if (dateObj.getDay() === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Impossibile prenotare di Domenica' })
  }

  // 2. Controllo Chiusure
  const targetDateStr = dateObj.toISOString().split('T')[0]
  const isClosed = await db.query.closureDates.findFirst({
    where: sql`DATE(${closureDates.date}) = ${targetDateStr}`
  })
  
  if (isClosed) {
    throw createError({ statusCode: 400, statusMessage: 'Il centro è chiuso in questa data' })
  }

  return await db.transaction(async (tx) => {
    const [booking] = await tx.insert(bookings).values({
      userId,
      studentId:      input.studentId,
      studentName:    student.firstName,
      studentSurname: student.lastName,
      studentPhone:   student.studentPhone ?? '',
      requestedDate:  dateObj,
      notes:          input.noteOrario ?? null,
      status:         'CONFIRMED',
    }).returning()

    if (input.materie.length > 0) {
      await tx.insert(bookingSubjects).values(
        input.materie.map((m) => ({
          name:      m,
          bookingId: booking.id,
        }))
      )
    }

    return booking
  })
}

// Lista prenotazioni per un GENITORE
export async function listBookingsForPortal(userId: string) {
  return await db.query.bookings.findMany({
    where: eq(bookings.userId, userId),
    orderBy: [desc(bookings.createdAt)],
    with: {
      subjects: {
        with: {
          assignedTutor: {
            columns: { firstName: true, lastName: true }
          }
        }
      },
    }
  })
}

// Lista prenotazioni per l'admin, filtrabili per studente (usa bookings.studentId)
export async function listBookingsForAdmin(studentId?: string) {
  return await db.query.bookings.findMany({
    where: studentId ? eq(bookings.studentId, studentId) : undefined,
    orderBy: [desc(bookings.createdAt)],
    with: {
      subjects: { columns: { name: true } },
      user:     { columns: { firstName: true, lastName: true, email: true } },
      student:  { columns: { firstName: true, lastName: true } },
    },
  })
}

// Conferma o cancella una prenotazione (solo ADMIN)
export async function updateBookingStatus(id: string, input: UpdateBookingStatusInput) {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, id),
  })

  if (!booking) {
    throw createError({ statusCode: 404, statusMessage: 'Prenotazione non trovata' })
  }

  const [updated] = await db.update(bookings)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(bookings.id, id))
    .returning()

  return updated
}
