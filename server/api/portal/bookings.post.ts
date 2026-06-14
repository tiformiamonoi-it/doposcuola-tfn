import { CreateBookingSchema } from '#shared/schemas/booking.schema'
import { createBooking } from '../../services/booking.service'
import { getLinkedStudentIds } from '../../utils/portal'
import { db } from '../../database/client'
import { students, packages } from '../../database/schema'
import { eq, and } from 'drizzle-orm'

// POST /api/portal/bookings
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato ai genitori' })
  }

  const body = await readBody(event)
  const result = CreateBookingSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  // Controlli temporali di sicurezza
  const requestedDate = new Date(result.data.dataDesiderata)
  const now = new Date()
  const todayStr = now.toLocaleDateString('sv').split('T')[0] // 'YYYY-MM-DD'
  const requestedStr = requestedDate.toISOString().split('T')[0]

  if (requestedStr === todayStr) {
    const limit = new Date(now)
    limit.setHours(11, 30, 0, 0)
    if (now.getTime() >= limit.getTime()) {
      throw createError({ statusCode: 400, statusMessage: 'Le prenotazioni per oggi si potevano effettuare solo entro le 11:30' })
    }
  } else if (requestedDate.getTime() < now.getTime() && requestedStr !== todayStr) {
    throw createError({ statusCode: 400, statusMessage: 'Non puoi prenotare una data nel passato' })
  }

  // Verifica che lo studentId appartenga a questo genitore
  const linkedIds = await getLinkedStudentIds(user.id)
  if (!linkedIds.includes(result.data.studentId)) {
    throw createError({ statusCode: 403, statusMessage: 'Non puoi prenotare per questo studente' })
  }

  // Verifica abilitatoPrenotazioneOnline
  const [student] = await db.select({ 
    abilitatoPrenotazioneOnline: students.abilitatoPrenotazioneOnline 
  }).from(students).where(eq(students.id, result.data.studentId))

  if (!student?.abilitatoPrenotazioneOnline) {
    throw createError({ statusCode: 403, statusMessage: 'Questo studente non è abilitato alla prenotazione online' })
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

  return await createBooking(result.data, user.id)
})
