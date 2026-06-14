import { deleteAccountingEntry } from '../../../services/accounting.service'

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
  return await deleteAccountingEntry(id, mode)
})
