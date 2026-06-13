import { getMonthlyCompensation } from '../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id     = getRouterParam(event, 'id')!
  const query  = getQuery(event)
  const months = query.months ? parseInt(String(query.months)) : 12

  return getMonthlyCompensation(id, isNaN(months) ? 12 : Math.min(months, 24))
})
