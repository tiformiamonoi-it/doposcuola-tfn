import { comunicazioniDelGenitore } from '../../services/comunicazioni.service'

// GET /api/portal/comunicazioni — le comunicazioni della segreteria a tutte le famiglie.
// Solo GENITORE (D4): agli account STUDENTE e all'admin in anteprima si risponde vuoto.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'GENITORE') return []
  return await comunicazioniDelGenitore(user.id)
})
