import { countContactsDaRicontattare } from '../../services/contact.service'
import { toHttpError } from '../../utils/http-error'

// GET /api/contacts/pending-count — badge rosso sulla voce "Contatti" del menu.
// Quanti contatti (Doposcuola + Marketing, archiviati esclusi) hanno il post-it
// "richiamare" scaduto o di oggi e non sono ancora chiusi (convertiti/persi).
// La policy in auth-policy.ts limita già tutto /api/contacts ad ADMIN/SUPER_TUTOR.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  try {
    return { count: await countContactsDaRicontattare() }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
