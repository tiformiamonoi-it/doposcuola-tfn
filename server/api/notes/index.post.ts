import { CreateNoteSchema } from '#shared/schemas/note.schema'
import { createNote } from '../../services/note.service'

export default defineEventHandler(async (event) => {
  const { user: sessionUser } = await requireUserSession(event)

  const body = await readBody(event)
  const result = CreateNoteSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati non validi',
      data: result.error.format()
    })
  }

  try {
    return await createNote(result.data, sessionUser.id)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 400, statusMessage: err.message })
  }
})
