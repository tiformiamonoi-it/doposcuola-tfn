import { getPackageRecharges } from '../../../services/package.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })

  const rows = await getPackageRecharges(id)
  return { data: rows }
})
