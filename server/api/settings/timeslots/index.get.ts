import { listTimeSlots } from '../../../services/timeslot.service'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const activeOnly = query.active === 'true'
  return listTimeSlots(activeOnly)
})