import { deleteNote } from '../../services/note.service'

export default defineEventHandler(async (event) => {
  const { user: sessionUser } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID richiesto' })

  return await deleteNote(id, sessionUser)
})
