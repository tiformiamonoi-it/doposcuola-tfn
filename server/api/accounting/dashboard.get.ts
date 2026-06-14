import { z } from 'zod'
import { getDashboard } from '../../services/accounting.service'

const querySchema = z.object({
  dataInizio: z.string().optional(),
  dataFine: z.string().optional(),
})

// GET /api/accounting/dashboard?dataInizio=YYYY-MM-DD&dataFine=YYYY-MM-DD
// Cruscotto finanziario sul periodo selezionato. Restituisce:
//   periodo          — entrate, uscite, margine netto nel periodo
//   perMetodo        — entrate e uscite per metodo (CONTANTI/BONIFICO/POS/ASSEGNO) nel periodo
//   saldiCassa       — rimanenze reali contanti/banca (sempre dall'inizio attività)
//   previsioni       — crediti e debiti
//   fattureInAttesa  — fatture richieste ma non emesse
// Default periodo: dal 1° gennaio dell'anno corrente a oggi.
export default defineEventHandler(async (event) => {
  const q = await getValidatedQuery(event, querySchema.parse)

  const ora = new Date()
  const start = q.dataInizio ? new Date(q.dataInizio) : new Date(ora.getFullYear(), 0, 1)
  const end = q.dataFine ? new Date(q.dataFine) : new Date(ora)
  end.setHours(23, 59, 59, 999)

  return getDashboard(start, end)
})
