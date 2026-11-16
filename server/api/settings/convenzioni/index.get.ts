import { elencoConvenzioni } from '../../../services/convenzioni.service'

// GET /api/settings/convenzioni — tutte le convenzioni, anche le scadute (Impostazioni → Sconti).
// Solo ADMIN, come il salvataggio delle Impostazioni (configs/index.put.ts).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN') throw createError({ statusCode: 403, message: 'Forbidden' })
  return await elencoConvenzioni()
})
