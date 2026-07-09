import { UpdateNoteSchema } from '#shared/schemas/note.schema'
import { updateNote } from '../../services/note.service'

export default defineEventHandler(async (event) => {
  const { user: sessionUser } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID richiesto' })

  const body = await readBody(event)
  const result = UpdateNoteSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati non validi',
      data: result.error.format()
    })
  }

  try {
    return await updateNote(id, result.data, sessionUser)
  } catch (err: any) {
    if (err.statusCode) throw err
    const code = err.message?.includes('non trovato') ? 404 : err.message?.includes('permessi') ? 403 : 400
    throw createError({ statusCode: code, statusMessage: err.message })
  }
})
