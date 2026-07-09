import { getCategorie } from '../../../utils/categorie'

// GET /api/accounting/categories — elenco categorie contabili (per form, filtri, etichette).
export default defineEventHandler(async () => {
  return await getCategorie()
})
