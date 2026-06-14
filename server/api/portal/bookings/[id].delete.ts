import { db } from '../../../database/client'
import { bookings, bookingSubjects } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'

// DELETE /api/portal/bookings/[id]
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato ai genitori' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID prenotazione mancante' })
  }

  // Cerca la prenotazione verificando la proprietà
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
    return { success: true, message: 'Prenotazione già annullata' }
  }

  const requestedDate = new Date(booking.requestedDate)
  const now = new Date()
  const todayStr = now.toLocaleDateString('sv').split('T')[0] // 'YYYY-MM-DD'
  const requestedStr = requestedDate.toISOString().split('T')[0]

  if (requestedStr === todayStr) {
    // Stesso giorno: controllo limite 12:30
    const limit = new Date(now)
    limit.setHours(12, 30, 0, 0)
    if (now.getTime() >= limit.getTime()) {
      throw createError({ statusCode: 400, statusMessage: 'Le lezioni per oggi potevano essere cancellate solo entro le 12:30' })
    }
  } else if (requestedDate.getTime() < now.getTime() && requestedStr !== todayStr) {
    // Passato
    throw createError({ statusCode: 400, statusMessage: 'Non puoi cancellare una lezione del passato' })
  }

  // Transazione per aggiornare lo stato ed eventualmente liberare tutor/slot abbinati
  await db.transaction(async (tx) => {
    // 1. Aggiorna lo stato della prenotazione
    await tx.update(bookings)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(eq(bookings.id, id))

    // 2. Libera abbinamenti tutor/slot per sicurezza
    await tx.update(bookingSubjects)
      .set({
        assignedTutorId: null,
        assignedSlot: null,
        assignedAt: null,
        updatedAt: new Date()
      })
      .where(eq(bookingSubjects.bookingId, id))
  })

  return { success: true, message: 'Prenotazione annullata con successo' }
})
