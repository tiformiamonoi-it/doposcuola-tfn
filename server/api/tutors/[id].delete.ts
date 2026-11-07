import { deactivateTutor } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  // Il SUPER_TUTOR archivia solo i TUTOR; un account che non può gestire risulta "non trovato"
  const result = await deactivateTutor(id, user.role)

  if (!result) throw createError({ statusCode: 404, statusMessage: 'Tutor non trovato' })

  return { ok: true }
})
