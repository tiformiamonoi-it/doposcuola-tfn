import { ListRientriQuerySchema } from '#shared/schemas/confirmation.schema'
import { listRientri } from '../../services/confirmation.service'
import { toHttpError } from '../../utils/http-error'

// GET /api/confirmations
// L'appello di inizio anno: l'elenco degli alunni attivi con la loro risposta,
// i numeri delle card, l'anno scolastico corrente e gli anni consultabili
// (`anni`, per il menu dello storico), in un'unica risposta.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const parsed = ListRientriQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Parametri di ricerca non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    return await listRientri(parsed.data)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
