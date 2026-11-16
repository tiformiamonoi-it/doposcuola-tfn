import { getCardTutor } from '../../services/card.service'

// GET /api/tutor/card — la card del TUTOR che chiede, e solo la sua: l'id viene dalla
// sessione. Chi non è TUTOR riceve null (la policy apre /api/tutor solo al TUTOR).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'TUTOR') return null
  return await getCardTutor(user.id)
})
