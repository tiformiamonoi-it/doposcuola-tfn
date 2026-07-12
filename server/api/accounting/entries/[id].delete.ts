import { deleteAccountingEntry } from '../../../services/accounting.service'
import { toHttpError } from '../../../utils/http-error'

// DELETE /api/accounting/entries/:id?mode=delete|storno
// mode=storno → crea un movimento opposto (mantiene lo storico)
// mode=delete → eliminazione vera (se automatico, elimina anche la sorgente)
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Riservato agli ADMIN' })
  }
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })

  const mode = getQuery(event).mode === 'storno' ? 'storno' : 'delete'
  try {
    return await deleteAccountingEntry(id, mode)
  } catch (err: any) {
    const code = err.message?.includes('non trovato') ? 404 : err.message?.includes('automatico') ? 403 : 400
    throw toHttpError(err, code)
  }
})
