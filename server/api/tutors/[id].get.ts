import { getTutorById } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const tutor = await getTutorById(id)

  if (!tutor) {
    throw createError({ statusCode: 404, statusMessage: 'Tutor non trovato' })
  }

  return tutor
})
