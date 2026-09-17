import { eq, and, gte, lte, ne, sql } from 'drizzle-orm'
import { db } from '../../../database/client'
import * as tables from '../../../database/schema'
import { AdminCreateBookingSchema } from '#shared/schemas/booking.schema'
import { stessoAlunno } from '#shared/matching'
import { valutaMaterieSpeciali } from '../../../services/booking.service'
import { toHttpError } from '../../../utils/http-error'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') throw createError({ statusCode: 403, message: 'Forbidden' })

  const body = await readBody(event)
  const parsed = AdminCreateBookingSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati prenotazione non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const data = parsed.data
  // Il giorno civile come lo legge GET /api/matching/:date (il giorno UTC della data)
  const dateStr = new Date(data.requestedDate).toISOString().split('T')[0]!
  const studentPhone = data.studentPhone || '0000000000'

  // Materie speciali: stesse regole del portale (max 1/giorno, fuori data → supplemento €10)
  let supplemento: string | null = null
  try {
    supplemento = await valutaMaterieSpeciali(data.subjects ?? [], dateStr)
  } catch (err: any) {
    throw toHttpError(err)
  }

  return await db.transaction(async (tx) => {
    // Un turno per giorno, con la stessa chiave del Matching (api/matching/assign.post.ts):
    // due aggiunte uguali nello stesso momento (doppio clic, o due persone) non passano
    // entrambe, perché la seconda fa il controllo qui sotto dopo che la prima ha salvato.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'matching:' + dateStr}))`)

    // N4 — niente doppioni: se quell'alunno ha già questa materia nello stesso giorno, no
    const materieNuove = new Set((data.subjects ?? []).map(m => m.trim().toLowerCase()))
    if (materieNuove.size > 0) {
      const giaPrenotate = await tx
        .select({
          materia:        tables.bookingSubjects.name,
          studentId:      tables.bookings.studentId,
          studentName:    tables.bookings.studentName,
          studentSurname: tables.bookings.studentSurname,
          studentPhone:   tables.bookings.studentPhone,
        })
        .from(tables.bookingSubjects)
        .innerJoin(tables.bookings, eq(tables.bookings.id, tables.bookingSubjects.bookingId))
        .where(and(
          gte(tables.bookings.requestedDate, new Date(`${dateStr}T00:00:00.000Z`)),
          lte(tables.bookings.requestedDate, new Date(`${dateStr}T23:59:59.999Z`)),
          ne(tables.bookings.status, 'CANCELLED'),
        ))

      const nuovo = {
        studentId: data.studentId || null,
        studentName: data.studentName,
        studentSurname: data.studentSurname,
        studentPhone,
      }
      const doppione = giaPrenotate.find(p =>
        materieNuove.has(p.materia.trim().toLowerCase()) && stessoAlunno(p, nuovo))
      if (doppione) {
        throw createError({
          statusCode: 409,
          statusMessage: `${data.studentName} ${data.studentSurname} ha già ${doppione.materia} in questo giorno`,
        })
      }
    }

    const [newBooking] = await tx.insert(tables.bookings).values({
      userId: user.id, // L'admin che sta creando la prenotazione o il genitore
      studentId: data.studentId || null,
      studentName: data.studentName,
      studentSurname: data.studentSurname,
      studentPhone,
      requestedDate: new Date(data.requestedDate),
      status: data.status,
      notes: data.notes || null,
      supplemento,
    }).returning()

    if (!newBooking) {
      throw createError({ statusCode: 500, statusMessage: 'Creazione prenotazione fallita' })
    }

    if (data.subjects && Array.isArray(data.subjects)) {
      const subjectsToInsert = data.subjects.map((s: string) => ({
        bookingId: newBooking.id,
        name: s
      }))

      if (subjectsToInsert.length > 0) {
        await tx.insert(tables.bookingSubjects).values(subjectsToInsert)
      }
    }

    return newBooking
  })
})
