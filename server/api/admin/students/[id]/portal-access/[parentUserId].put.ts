import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../../../database/client'
import { studentParents } from '../../../../../database/schema'
import { inviaLinkPassword } from '../../../../../services/portal-user.service'
import { toHttpError } from '../../../../../utils/http-error'

const PutSchema = z.discriminatedUnion('action', [
  // Storicamente 'reset-password'; oggi manda un link per SCEGLIERE la password
  // (l'etichetta resta per non rompere le chiamate già in giro nel frontend)
  z.object({ action: z.literal('reset-password') }),
])

// PUT /api/admin/students/:id/portal-access/:parentUserId
// Azioni su UN singolo genitore collegato all'alunno
// (per ora: manda il link "scegli la tua password").
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  const parentUserId = getRouterParam(event, 'parentUserId')
  if (!parentUserId) throw createError({ statusCode: 400, statusMessage: 'ID genitore mancante' })

  const body = await readBody(event)
  const result = PutSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: result.error.format() })
  }

  // Il genitore deve essere davvero collegato a questo alunno
  const collegato = await db.query.studentParents.findFirst({
    where: and(
      eq(studentParents.studentId, studentId),
      eq(studentParents.parentUserId, parentUserId),
    ),
    columns: { id: true },
  })
  if (!collegato) {
    throw createError({ statusCode: 404, statusMessage: 'Genitore non collegato a questo alunno' })
  }

  try {
    // motivoEmail/dettaglioEmail valorizzati solo se l'email non è partita
    const { linkPassword, emailInviata, motivoEmail, dettaglioEmail } = await inviaLinkPassword(parentUserId)
    return { ok: true, linkPassword, emailInviata, motivoEmail, dettaglioEmail }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
