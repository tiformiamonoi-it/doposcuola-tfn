import { listStudentNotes } from '../../../services/note.service'

export default defineEventHandler(async (event) => {
  const { user: sessionUser } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID studente richiesto' })

  const notes = await listStudentNotes(id)

  // Privacy autore: un TUTOR vede il nome vero solo sulle proprie note,
  // le altre risultano scritte dalla "Segreteria" (mascherate lato server).
  if (sessionUser.role !== 'TUTOR') return notes
  return notes.map((n: any) => n.authorId === sessionUser.id
    ? n
    : { ...n, authorId: null, author: { id: null, firstName: 'Segreteria', lastName: '', role: null } })
})
