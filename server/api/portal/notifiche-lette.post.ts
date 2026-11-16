import { segnaNotificheLette } from '../../services/notifiche-portale.service'

// POST /api/portal/notifiche-lette — "Segna tutte come lette": la data "viste fino a" diventa adesso.
// Solo genitore e studente: l'admin in anteprima non ha notifiche da segnare.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (['GENITORE', 'STUDENTE'].includes(user.role)) await segnaNotificheLette(user.id)
  return { ok: true }
})
