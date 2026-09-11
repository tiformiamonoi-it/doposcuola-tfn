import { z } from 'zod'
import { genitoriPortaleDi, impostaConsenso } from '../../../../services/consensi.service'
import { toHttpError } from '../../../../utils/http-error'

// POST /api/admin/students/:id/consensi
// La segreteria registra un consenso raccolto di persona (o al telefono).
//
// Due cose non arrivano MAI dal browser, e per questo non sono nello schema:
//  • `origine`, che qui è sempre 'GESTIONALE' — chi passa da questo indirizzo sta
//    usando il gestionale, e dire il contrario servirebbe solo a falsare lo storico;
//  • `attoreUserId`, che si legge dalla SESSIONE: così nessuno può registrare un
//    consenso a nome di un collega. È la stessa regola del consenso raccolto alla
//    creazione dell'account studente.
const BodySchema = z.object({
  tipo:   z.enum(['MINORE_14', 'IMMAGINI', 'MARKETING']),
  valore: z.boolean(),
  // Solo per MARKETING: il genitore a cui il consenso appartiene
  userId: z.string().min(1).optional(),
  note:   z.string().max(500).optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  // Doppia chiusura, come in /api/admin/genitori/cerca: la policy di /api/admin
  // lo fa già, ma un consenso privacy non deve poter diventare modificabile da un
  // tutor per effetto collaterale di una modifica futura alla policy.
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  const parsed = BodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message ?? 'Dati non validi' })
  }

  const { tipo, valore, userId, note } = parsed.data

  try {
    if (tipo === 'MARKETING') {
      if (!userId) {
        throw createError({ statusCode: 422, statusMessage: 'Il consenso marketing è della persona: indica il genitore.' })
      }
      // Il genitore indicato deve essere davvero uno dei genitori di QUESTO alunno.
      // Senza questo controllo, da una scheda si potrebbe cambiare il consenso di
      // una persona qualsiasi del portale scrivendone l'identificativo a mano.
      const genitori = await genitoriPortaleDi(studentId)
      if (!genitori.some((g) => g.userId === userId)) {
        throw createError({ statusCode: 403, statusMessage: 'Questo genitore non è collegato a questo alunno.' })
      }

      // Niente studentId: il marketing è della persona, non del figlio.
      return await impostaConsenso({
        tipo, valore, userId, note,
        origine: 'GESTIONALE',
        attoreUserId: user.id,
      })
    }

    return await impostaConsenso({
      tipo, valore, studentId, userId, note,
      origine: 'GESTIONALE',
      attoreUserId: user.id,
    })
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovato') ? 404 : 400)
  }
})
