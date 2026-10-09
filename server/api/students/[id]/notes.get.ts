import { listStudentNotes } from '../../../services/note.service'

// GET /api/students/:id/notes
// ADMIN e SUPER_TUTOR ricevono tutte le note; un TUTOR solo le interne e quelle per
// la famiglia già approvate (il filtro è dentro listStudentNotes).
// Il nome dell'autore è quello vero per tutti: tra colleghi si sa chi ha scritto
// cosa (decisione D6). Verso le famiglie invece resta "Segreteria", ma quello
// è il portale (getPortalNotes), un'altra strada che qui non passa.
export default defineEventHandler(async (event) => {
  const { user: sessionUser } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID studente richiesto' })

  return await listStudentNotes(id, sessionUser.role)
})
