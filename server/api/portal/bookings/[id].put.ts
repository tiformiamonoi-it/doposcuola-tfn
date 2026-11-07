import { db } from '../../../database/client'
import { bookings, bookingSubjects, closureDates } from '../../../database/schema'
import { UpdateBookingSchema } from '#shared/schemas/booking.schema'
import { eq } from 'drizzle-orm'
import { getPortalStudentIds } from '../../../utils/portal'
import { valutaMaterieSpeciali } from '../../../services/booking.service'
import { toHttpError } from '../../../utils/http-error'
import { oggiRomeStr, oraRomeAlmeno } from '../../../utils/tutor-time-window'
import { isDomenica } from '#shared/giorno-civile'

// PUT /api/portal/bookings/[id] — genitore o studente collegato
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['GENITORE', 'STUDENTE'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato a genitori e studenti' })
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

  // Proprietà: relativa a uno studente collegato
  // (così genitore e studente possono agire sulle stesse prenotazioni)
  const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, id) })
  const portalIds = await getPortalStudentIds(user)
  // Se la prenotazione ha uno studente conta solo il legame attuale con lui:
  // chi è stato scollegato dal figlio perde l'accesso anche a quelle che aveva creato.
  // Il "creata da me" vale solo per le prenotazioni storiche senza studente.
  const isOwner = booking && (booking.studentId ? portalIds.includes(booking.studentId) : booking.userId === user.id)

  if (!booking || !isOwner) {
    throw createError({ statusCode: 404, statusMessage: 'Prenotazione non trovata' })
  }

  if (booking.status === 'CANCELLED') {
    throw createError({ statusCode: 400, statusMessage: 'Non puoi modificare una prenotazione annullata' })
  }

  const originalDate = new Date(booking.requestedDate)
  const newDate = new Date(result.data.dataDesiderata)
  const now = new Date()
  // Giorno civile italiano (il fuso del server su Vercel è UTC)
  const todayStr = oggiRomeStr()

  const originalStr = originalDate.toISOString().split('T')[0]
  const newStr = newDate.toISOString().split('T')[0]

  // 1. Controllo orario limite 11:30 per oggi sulla data originale
  if (originalStr === todayStr) {
    if (oraRomeAlmeno(11, 30)) {
      throw createError({ statusCode: 400, statusMessage: 'Non puoi modificare una prenotazione per oggi dopo le 11:30' })
    }
  } else if (originalDate.getTime() < now.getTime() && originalStr !== todayStr) {
    throw createError({ statusCode: 400, statusMessage: 'Non puoi modificare una prenotazione passata' })
  }

  // 2. Controllo orario limite 11:30 per oggi sulla NUOVA data
  if (newStr === todayStr) {
    if (oraRomeAlmeno(11, 30)) {
      throw createError({ statusCode: 400, statusMessage: 'Non puoi spostare la prenotazione a oggi dopo le 11:30' })
    }
  } else if (newDate.getTime() < now.getTime() && newStr !== todayStr) {
    throw createError({ statusCode: 400, statusMessage: 'Non puoi spostare la prenotazione al passato' })
  }

  // 3. Verifica Domenica per la nuova data (stesso giorno civile usato per le chiusure)
  if (isDomenica(newStr!)) {
    throw createError({ statusCode: 400, statusMessage: 'Impossibile spostare la lezione di Domenica' })
  }

  // 4. Verifica giorni di chiusura per la nuova data (colonna date: confronto diretto)
  const isClosed = await db.query.closureDates.findFirst({
    where: eq(closureDates.date, newStr!)
  })
  
  if (isClosed) {
    throw createError({ statusCode: 400, statusMessage: 'Il centro è chiuso nella data selezionata' })
  }

  // 5. Materie speciali: ricalcola il supplemento su nuova data/materie.
  // Se il supplemento è GIÀ stato applicato al pacchetto, non si tocca
  // (l'eventuale rimborso lo gestisce la segreteria a mano).
  let nuovoSupplemento: string | null
  try {
    nuovoSupplemento = await valutaMaterieSpeciali(result.data.materie, newStr!)
  } catch (err: any) {
    throw toHttpError(err)
  }

  // Esegue l'aggiornamento in transazione per garantire integrità
  await db.transaction(async (tx) => {
    // 1. Aggiorna la data e le note della prenotazione principale
    await tx.update(bookings)
      .set({
        requestedDate: newDate,
        notes: result.data.noteOrario ?? null,
        ...(booking.supplementoApplicatoAt ? {} : { supplemento: nuovoSupplemento }),
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
