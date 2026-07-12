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

  const body = await readValidatedBody(event, (b) => RechargePackageSchema.parse(b))

  try {
    const pkg = await rechargePackage(id, body)
    return { data: pkg }
  } catch (err: any) {
    throw toHttpError(err)
  }
})
