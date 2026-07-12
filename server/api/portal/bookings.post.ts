import { CreateBookingSchema } from '#shared/schemas/booking.schema'
import { createBooking } from '../../services/booking.service'
import { getPortalStudentIds } from '../../utils/portal'
import { db } from '../../database/client'
import { students, packages } from '../../database/schema'
import { eq, and } from 'drizzle-orm'
import { toHttpError } from '../../utils/http-error'

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
  
  // Otteniamo la data odierna in Italia come YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  const formattedParts = formatter.formatToParts(now)
  const p = (type: string) => formattedParts.find(x => x.type === type)?.value
  const todayStr = `${p('year')}-${p('month')}-${p('day')}`
  const italyHour = parseInt(p('hour') || '0', 10)
  const italyMinute = parseInt(p('minute') || '0', 10)

  const requestedStr = requestedDate.toISOString().split('T')[0]

  if (requestedStr === todayStr) {
    if (italyHour > 11 || (italyHour === 11 && italyMinute >= 30)) {
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

  // Verifica pacchetto attivo
  const activePackages = await db.select({ id: packages.id })
    .from(packages)
    .where(
      and(
        eq(packages.studentId, result.data.studentId)
      )
    )

  const hasActivePackage = activePackages.some(pkg => {
    // In Drizzle, le query potrebbero restituire stati non inizializzati, quindi facciamo un controllo sul DB oppure a livello applicativo
    // Assumiamo che se non c'è almeno un pacchetto, allora non va bene, ma per l'array 'stati' dobbiamo usare sql o filter post-select
    return true // Il controllo vero lo facciamo dopo
  })
  
  // Meglio filtrare direttamente in JS dato che l'array PostgreSQL "stati" potrebbe essere ostico con le funzioni ORM base
  const studentPackages = await db.select({ stati: packages.stati })
    .from(packages)
    .where(eq(packages.studentId, result.data.studentId))
    
  const hasActive = studentPackages.some(p => p.stati && p.stati.includes('ATTIVO'))
  if (!hasActive) {
    throw createError({ statusCode: 403, statusMessage: 'Nessun pacchetto ATTIVO trovato per questo studente' })
  }

  // Verifica se esiste già una prenotazione per questo studente in questa data
  // Carichiamo tutte le prenotazioni future o odierne dello studente per fare il controllo
  // Importiamo bookings da schema se non l'abbiamo fatto
  const { bookings } = await import('../../database/schema')
  
  const existingBookings = await db.select({ requestedDate: bookings.requestedDate, status: bookings.status })
    .from(bookings)
    .where(eq(bookings.studentId, result.data.studentId))
  
  const alreadyBooked = existingBookings.some(b => {
    if (b.status === 'CANCELLED') return false
    const bDateStr = new Date(b.requestedDate).toISOString().split('T')[0]
    return bDateStr === requestedStr
  })

  if (alreadyBooked) {
    throw createError({ statusCode: 409, statusMessage: 'Hai già una lezione prenotata per questa data. Vai alla dashboard per modificarla.' })
  }

  try {
    return await createBooking(result.data, user.id)
  } catch (err: any) {
    if (err.statusCode) throw err
    const code = err.message?.includes('non trovato') ? 404 : err.message?.includes('Domenica') || err.message?.includes('chiuso') ? 400 : 400
    throw toHttpError(err, code)
  }
})
