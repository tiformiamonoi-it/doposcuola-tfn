import { db } from '../../../database/client'
import { bookings, bookingSubjects, closureDates } from '../../../database/schema'
import { UpdateBookingSchema } from '#shared/schemas/booking.schema'
import { eq, and, sql } from 'drizzle-orm'

// PUT /api/portal/bookings/[id]
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato ai genitori' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID prenotazione mancante' })
  }

  const body = await readBody(event)
  const result = UpdateBookingSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  // Cerca la prenotazione originale verificando la proprietà
  const booking = await db.query.bookings.findFirst({
    where: and(
      eq(bookings.id, id),
      eq(bookings.userId, user.id)
    )
  })

  if (!booking) {
    throw createError({ statusCode: 404, statusMessage: 'Prenotazione non trovata' })
  }

  if (booking.status === 'CANCELLED') {
    throw createError({ statusCode: 400, statusMessage: 'Non puoi modificare una prenotazione annullata' })
  }

  const originalDate = new Date(booking.requestedDate)
  const newDate = new Date(result.data.dataDesiderata)
  const now = new Date()
  const todayStr = now.toLocaleDateString('sv').split('T')[0] // 'YYYY-MM-DD'
  
  const originalStr = originalDate.toISOString().split('T')[0]
  const newStr = newDate.toISOString().split('T')[0]

  // 1. Controllo orario limite 11:30 per oggi sulla data originale
  if (originalStr === todayStr) {
    const limit = new Date(now)
    limit.setHours(11, 30, 0, 0)
    if (now.getTime() >= limit.getTime()) {
      throw createError({ statusCode: 400, statusMessage: 'Non puoi modificare una prenotazione per oggi dopo le 11:30' })
    }
  } else if (originalDate.getTime() < now.getTime() && originalStr !== todayStr) {
    throw createError({ statusCode: 400, statusMessage: 'Non puoi modificare una prenotazione passata' })
  }

  // 2. Controllo orario limite 11:30 per oggi sulla NUOVA data
  if (newStr === todayStr) {
    const limit = new Date(now)
    limit.setHours(11, 30, 0, 0)
    if (now.getTime() >= limit.getTime()) {
      throw createError({ statusCode: 400, statusMessage: 'Non puoi spostare la prenotazione a oggi dopo le 11:30' })
    }
  } else if (newDate.getTime() < now.getTime() && newStr !== todayStr) {
    throw createError({ statusCode: 400, statusMessage: 'Non puoi spostare la prenotazione al passato' })
  }

  // 3. Verifica Domenica per la nuova data
  if (newDate.getDay() === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Impossibile spostare la lezione di Domenica' })
  }

  // 4. Verifica giorni di chiusura per la nuova data
  const isClosed = await db.query.closureDates.findFirst({
    where: sql`DATE(${closureDates.date}) = ${newStr}`
  })
  
  if (isClosed) {
    throw createError({ statusCode: 400, statusMessage: 'Il centro è chiuso nella data selezionata' })
  }

  // Esegue l'aggiornamento in transazione per garantire integrità
  await db.transaction(async (tx) => {
    // 1. Aggiorna la data e le note della prenotazione principale
    await tx.update(bookings)
      .set({
        requestedDate: newDate,
        notes: result.data.noteOrario ?? null,
        updatedAt: new Date()
      })
      .where(eq(bookings.id, id))

    // 2. Rimuove le vecchie materie
    await tx.delete(bookingSubjects)
      .where(eq(bookingSubjects.bookingId, id))

    // 3. Inserisce le nuove materie (con tutor/slot resettati a null)
    if (result.data.materie.length > 0) {
      await tx.insert(bookingSubjects).values(
        result.data.materie.map((m) => ({
          name: m,
          bookingId: id,
          assignedTutorId: null,
          assignedSlot: null,
          assignedAt: null
        }))
      )
    }
  })

  return { success: true, message: 'Prenotazione modificata con successo' }
})
