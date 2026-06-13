import { getMonthlyPerformance } from '../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id     = getRouterParam(event, 'id')!
  const query  = getQuery(event)
  const months = query.months ? parseInt(String(query.months)) : 6

  return getMonthlyPerformance(id, isNaN(months) ? 6 : Math.min(months, 12))
})
