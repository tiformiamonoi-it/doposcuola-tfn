import { getKpiMese } from '../../services/analytics.service'

// GET /api/accounting/kpi-mese — solo ADMIN (policy /api/accounting)
export default defineEventHandler(async () => {
  return await getKpiMese()
})
