import { eq, and, gte, lte, ne, isNotNull, sql } from 'drizzle-orm'
import { db } from '../../database/client'
import * as tables from '../../database/schema'
import { AssignTutorSlotSchema } from '#shared/schemas/matching.schema'
import { stessoAlunno } from '#shared/matching'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') throw createError({ statusCode: 403, message: 'Forbidden' })

  const body = await readBody(event)
  const parsed = AssignTutorSlotSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati assegnazione non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const { subjectId, tutorId, slot } = parsed.data

  // Se tutorId e slot sono null, rimuove assegnazione
  const updateData = {
    assignedTutorId: tutorId || null,
    assignedSlot: slot || null,
    assignedAt: tutorId && slot ? new Date() : null
  }

  const subject = await db.transaction(async (tx) => {
    // N4 — niente doppioni: lo stesso alunno non può stare in due posti nella stessa
    // fascia oraria dello stesso giorno, nemmeno con due tutor diversi o per due materie
    // diverse. Togliere un'assegnazione invece è sempre permesso.
    if (tutorId && slot) {
      const [questa] = await tx
        .select({
          studentId:      tables.bookings.studentId,
          studentName:    tables.bookings.studentName,
          studentSurname: tables.bookings.studentSurname,
          studentPhone:   tables.bookings.studentPhone,
          requestedDate:  tables.bookings.requestedDate,
        })
        .from(tables.bookingSubjects)
        .innerJoin(tables.bookings, eq(tables.bookings.id, tables.bookingSubjects.bookingId))
        .where(eq(tables.bookingSubjects.id, subjectId))
      if (!questa) {
        throw createError({ statusCode: 404, statusMessage: 'Prenotazione non trovata: premi Aggiorna' })
      }

      // Lo stesso giorno civile di GET /api/matching/:date (il giorno UTC della data richiesta)
      const giorno = questa.requestedDate.toISOString().slice(0, 10)

      // Un turno per giorno: se due persone assegnano nello stesso momento, la seconda
      // aspetta qui che la prima abbia finito, e poi il controllo qui sotto vede anche
      // la sua assegnazione. Senza, tutte e due guarderebbero "prima" e passerebbero.
      // Stessa chiave dell'aggiunta manuale (api/admin/bookings/index.post.ts).
      // ponytail: un lucchetto per l'intero giorno mette in fila anche alunni diversi;
      //   ogni assegnazione dura pochi millisecondi, basta e avanza per la segreteria.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'matching:' + giorno}))`)

      const giaInFascia = await tx
        .select({
          materia:        tables.bookingSubjects.name,
          tutorNome:      tables.users.firstName,
          tutorCognome:   tables.users.lastName,
          studentId:      tables.bookings.studentId,
          studentName:    tables.bookings.studentName,
          studentSurname: tables.bookings.studentSurname,
          studentPhone:   tables.bookings.studentPhone,
        })
        .from(tables.bookingSubjects)
        .innerJoin(tables.bookings, eq(tables.bookings.id, tables.bookingSubjects.bookingId))
        .leftJoin(tables.users, eq(tables.users.id, tables.bookingSubjects.assignedTutorId))
        .where(and(
          gte(tables.bookings.requestedDate, new Date(`${giorno}T00:00:00.000Z`)),
          lte(tables.bookings.requestedDate, new Date(`${giorno}T23:59:59.999Z`)),
          ne(tables.bookings.status, 'CANCELLED'),
          eq(tables.bookingSubjects.assignedSlot, slot),
          isNotNull(tables.bookingSubjects.assignedTutorId),
          ne(tables.bookingSubjects.id, subjectId),
        ))

      // Chi è "lo stesso alunno" lo decide shared/matching.ts, la stessa regola della pagina
      const doppione = giaInFascia.find(altra => stessoAlunno(altra, questa))
      if (doppione) {
        const conChi = doppione.tutorNome ? `${doppione.tutorNome} ${doppione.tutorCognome}` : 'un altro tutor'
        throw createError({
          statusCode: 409,
          statusMessage: `${questa.studentName} ${questa.studentSurname} è già alle ${slot} con ${conChi} (${doppione.materia})`,
        })
      }
    }

    const [aggiornata] = await tx.update(tables.bookingSubjects)
      .set(updateData)
      .where(eq(tables.bookingSubjects.id, subjectId))
      .returning()
    return aggiornata
  })

  return {
    message: tutorId ? 'Assegnazione salvata' : 'Assegnazione rimossa',
    subject
  }
})
