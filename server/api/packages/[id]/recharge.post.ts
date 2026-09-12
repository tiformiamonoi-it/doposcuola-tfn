import { RechargePackageSchema } from '#shared/schemas/package.schema'
import { rechargePackage } from '../../../services/package.service'
import { toHttpError } from '../../../utils/http-error'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })

  // Il corpo grezzo serve per la spunta del bollo (F1): viaggia dentro
  // "pagamentoIniziale" ma non passa dallo schema, che è in mano a un altro
  // intervento in corso. Solo un "false" esplicito toglie il bollo.
  const raw  = await readBody(event)
  const body = await readValidatedBody(event, (b) => RechargePackageSchema.parse(b))
  const aggiungiBollo = raw?.pagamentoIniziale?.aggiungiBollo !== false

  try {
    const pkg = await rechargePackage(id, body, { aggiungiBollo })
    return { data: pkg }
  } catch (err: any) {
    throw toHttpError(err)
  }
})
