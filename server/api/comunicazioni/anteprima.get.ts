import { ComunicazioneTipoEnum } from '#shared/schemas/comunicazione.schema'
import { contaDestinatari } from '../../services/comunicazioni.service'
import { toHttpError } from '../../utils/http-error'

// GET /api/comunicazioni/anteprima?tipo=INFORMATIVA|PROMOZIONALE
// "La riceveranno N famiglie": quanti genitori la riceverebbero adesso.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const tipo = ComunicazioneTipoEnum.safeParse(getQuery(event).tipo)
  if (!tipo.success) throw createError({ statusCode: 422, statusMessage: 'Tipo di comunicazione non valido' })

  try {
    return { destinatari: await contaDestinatari(tipo.data) }
  } catch (err) {
    throw toHttpError(err)
  }
})
