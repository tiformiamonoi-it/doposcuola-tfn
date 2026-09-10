import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../../database/client'
import { users } from '../../../database/schema'
import { inviaInvitoPasswordAUtente } from '../../../utils/password-token'
import { toHttpError } from '../../../utils/http-error'

// POST /api/tutors/:id/link-password
// Manda al tutor un link "scegli la tua password" (e lo restituisce alla
// segreteria, che può copiarlo e mandarlo su WhatsApp se la posta non parte).
//
// NON tocca la password attuale: se il tutor non apre il link continua a
// entrare come prima. Solo ADMIN/SUPER_TUTOR (già imposto da API_POLICY su /api/tutors).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID tutor mancante' })

  // Questa route vive sotto /api/tutors: deve poter agire solo su account staff,
  // mai su un genitore o uno studente passato per id.
  const target = await db.query.users.findFirst({
    where: and(eq(users.id, id), inArray(users.role, ['TUTOR', 'SUPER_TUTOR', 'ADMIN'])),
    columns: { id: true },
  })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Tutor non trovato' })

  try {
    // motivoEmail/dettaglioEmail arrivano solo quando l'email NON è partita:
    // la segreteria deve leggere a schermo il motivo vero, non un generico errore.
    const { email, linkPassword, emailInviata, motivoEmail, dettaglioEmail } = await inviaInvitoPasswordAUtente(id)
    return { ok: true, email, linkPassword, emailInviata, motivoEmail, dettaglioEmail }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
