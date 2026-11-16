import { z } from 'zod'
import { segnaNotificheLette } from '../../services/notifiche-portale.service'

// POST /api/portal/notifiche-lette — la data "viste fino a" diventa adesso (pagina Notifiche
// aperta, "Segna tutte come lette"), oppure `fino` = la data della voce toccata dalla Home.
// Solo genitore e studente: l'admin in anteprima non ha notifiche da segnare.
const BodySchema = z.object({ fino: z.iso.datetime().optional() }).optional()

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readValidatedBody(event, BodySchema.parse)
  if (['GENITORE', 'STUDENTE'].includes(user.role)) await segnaNotificheLette(user.id, body?.fino ? new Date(body.fino) : undefined)
  return { ok: true }
})
