import { CreateBookingSchema } from '#shared/schemas/booking.schema'
import { createBooking } from '../../services/booking.service'
import { getPortalStudentIds } from '../../utils/portal'
import { db } from '../../database/client'
import { students, packages, bookings } from '../../database/schema'
import { eq } from 'drizzle-orm'
import { toHttpError } from '../../utils/http-error'
import { oggiRomeStr, oraRomeAlmeno } from '../../utils/tutor-time-window'

// POST /api/portal/bookings — genitori e studenti (account studente = solo prenotazioni)
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['GENITORE', 'STUDENTE'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato a genitori e studenti' })
  }

  const body = await readBody(event)
  const result = CreateBookingSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  // Controlli temporali di sicurezza (fuso orario italiano)
  const requestedDate = new Date(result.data.dataDesiderata)
  const now = new Date()
  // Giorno e ora italiani dallo stesso helper di modifica e cancellazione
  const todayStr = oggiRomeStr()

  const requestedStr = requestedDate.toISOString().split('T')[0]

  if (requestedStr === todayStr) {
    if (oraRomeAlmeno(11, 30)) {
      throw createError({ statusCode: 400, statusMessage: 'Le prenotazioni per oggi si potevano effettuare solo entro le 11:30' })
    }
  } else if (requestedDate.getTime() < now.getTime() && requestedStr !== todayStr) {
    throw createError({ statusCode: 400, statusMessage: 'Non puoi prenotare una data nel passato' })
  }

  // Verifica che lo studentId appartenga a questo utente (figlio del genitore o sé stesso)
  const linkedIds = await getPortalStudentIds(user)
  if (!linkedIds.includes(result.data.studentId)) {
    throw createError({ statusCode: 403, statusMessage: 'Non puoi prenotare per questo studente' })
  }

  // Verifica abilitatoPrenotazioneOnline (solo per il genitore: per lo STUDENTE
  // l'autorizzazione è l'account stesso, attivo di default e disattivabile dall'admin)
  if (user.role === 'GENITORE') {
    const [student] = await db.select({
      abilitatoPrenotazioneOnline: students.abilitatoPrenotazioneOnline
    }).from(students).where(eq(students.id, result.data.studentId))

    if (!student?.abilitatoPrenotazioneOnline) {
      throw createError({ statusCode: 403, statusMessage: 'Questo studente non è abilitato alla prenotazione online' })
    }
  }

  // Serve un pacchetto con ORE ancora da usare, non chiuso e non sospeso.
  // La SCADENZA invece non blocca (decisione della segreteria: la lezione si fa
  // prenotare comunque). Prima si guardava lo stato salvato ATTIVO, che sparisce
  // alla scadenza solo quando il pacchetto viene riscritto: la stessa famiglia
  // veniva bloccata o no a seconda che il pacchetto fosse stato toccato di recente.
  const studentPackages = await db.select({ stati: packages.stati, oreResiduo: packages.oreResiduo, sospeso: packages.sospeso })
    .from(packages)
    .where(eq(packages.studentId, result.data.studentId))

  const haOre = studentPackages.some(p =>
    !p.sospeso && !(p.stati ?? []).includes('CHIUSO') && parseFloat(p.oreResiduo) > 0)
  if (!haOre) {
    throw createError({ statusCode: 403, statusMessage: 'Nessun pacchetto con ore disponibili trovato per questo studente' })
  }

  // Verifica se esiste già una prenotazione per questo studente in questa data
  const existingBookings = await db.select({ requestedDate: bookings.requestedDate, status: bookings.status })
    .from(bookings)
    .where(eq(bookings.studentId, result.data.studentId))
  
  const alreadyBooked = existingBookings.some(b => {
    if (b.status === 'CANCELLED') return false
    const bDateStr = new Date(b.requestedDate).toISOString().split('T')[0]
    return bDateStr === requestedStr
  })

  if (alreadyBooked) {
    // Il messaggio lo legge un genitore: niente "dashboard", si dice dove andare.
    throw createError({ statusCode: 409, statusMessage: 'Per questo giorno c\'è già una prenotazione. La trovi nella home del portale, dove puoi modificarla o annullarla.' })
  }

  try {
    return await createBooking(result.data, user.id)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
