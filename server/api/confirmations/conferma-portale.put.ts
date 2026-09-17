import { ConfermaPortaleSchema } from '#shared/schemas/confirmation.schema'
import { impostaConfermaPortale } from '../../services/confirmation.service'
import { toHttpError } from '../../utils/http-error'

// PUT /api/confirmations/conferma-portale
// Accende o spegne la domanda «torna da noi quest'anno?» nel portale famiglie.
// Non passa da /api/settings/configs perché quello lo scrive solo l'ADMIN, e
// l'interruttore sta nella pagina Rientri, che usa anche il SUPER_TUTOR: la
// policy in auth-policy.ts limita già tutto /api/confirmations ad ADMIN/SUPER_TUTOR.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const parsed = ConfermaPortaleSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Valore dell\'interruttore non valido',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    return { accesa: await impostaConfermaPortale(parsed.data.accesa) }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
