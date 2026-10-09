import { storicoComunicazioni } from '../../services/comunicazioni.service'
import { toHttpError } from '../../utils/http-error'

// GET /api/comunicazioni — lo storico delle comunicazioni a tutte le famiglie.
// La policy in auth-policy.ts limita tutto /api/comunicazioni ad ADMIN/SUPER_TUTOR.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  try {
    return await storicoComunicazioni()
  } catch (err) {
    throw toHttpError(err)
  }
})
