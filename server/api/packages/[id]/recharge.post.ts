import { RechargePackageSchema } from '../../../../shared/schemas/package.schema'
import { rechargePackage } from '../../../services/package.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })

  const body = await readValidatedBody(event, (b) => RechargePackageSchema.parse(b))

  try {
    const pkg = await rechargePackage(id, body)
    return { data: pkg }
  } catch (err: any) {
    throw createError({ statusCode: 400, statusMessage: err.message })
  }
})
