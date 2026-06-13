import { deactivateTutor } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const result = await deactivateTutor(id)

  if (!result) throw createError({ statusCode: 404, statusMessage: 'Tutor non trovato' })

  return { ok: true }
})
