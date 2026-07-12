import { deleteNote } from '../../services/note.service'
import { toHttpError } from '../../utils/http-error'

export default defineEventHandler(async (event) => {
  const { user: sessionUser } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID richiesto' })

  try {
    return await deleteNote(id, sessionUser)
  } catch (err: any) {
    if (err.statusCode) throw err
    const code = err.message?.includes('non trovato') ? 404 : err.message?.includes('permessi') ? 403 : 400
    throw toHttpError(err, code)
  }
})
