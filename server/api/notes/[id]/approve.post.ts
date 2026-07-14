import { approveNote } from '../../../services/note.service'
import { toHttpError } from '../../../utils/http-error'

// POST /api/notes/:id/approve — solo ADMIN/SUPER_TUTOR.
// Rende visibile alla famiglia una nota FAMIGLIA scritta da un TUTOR.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID nota richiesto' })

  try {
    return await approveNote(id, user)
  } catch (err: any) {
    const code = err.message?.includes('permessi') ? 403 : err.message?.includes('non trovata') ? 404 : 400
    throw toHttpError(err, code)
  }
})
