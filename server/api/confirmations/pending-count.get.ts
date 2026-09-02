import { countRientriDaSentire } from '../../services/confirmation.service'
import { toHttpError } from '../../utils/http-error'

// GET /api/confirmations/pending-count — pallino rosso sulla voce "Rientri" del menu.
// Quanti alunni attivi non hanno ancora dato una risposta per l'anno corrente.
// La policy in auth-policy.ts limita già tutto /api/confirmations ad ADMIN/SUPER_TUTOR.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  try {
    return { count: await countRientriDaSentire() }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
