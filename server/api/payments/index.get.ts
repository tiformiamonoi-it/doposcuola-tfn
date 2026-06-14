import { listPayments } from '../../services/payment.service'

// GET /api/payments?packageId=...
// Elenco pagamenti (usato dallo storico nel modal pagamento del pacchetto).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Riservato ad ADMIN/SUPER_TUTOR' })
  }
  const q = getQuery(event)
  return await listPayments({
    packageId: typeof q.packageId === 'string' ? q.packageId : undefined,
    page:  q.page  ? Number(q.page)  : 1,
    limit: q.limit ? Number(q.limit) : 100,
  } as any)
})
