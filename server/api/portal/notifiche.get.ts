import { notifichePortale } from '../../services/notifiche-portale.service'

// GET /api/portal/notifiche — le notifiche del portale (calcolate al volo) e quante sono nuove.
// Il numero serve anche al pallino del menu (layouts/portal.vue).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  return await notifichePortale(user)
})
