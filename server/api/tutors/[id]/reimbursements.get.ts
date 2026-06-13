import { listReimbursements } from '../../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  return listReimbursements(id)
})
