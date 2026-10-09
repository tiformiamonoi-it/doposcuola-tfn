import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { users } from '../../database/schema'
import { ultimaVersione } from '#shared/changelog'

// POST /api/auth/tutorial-visto — segna il tutorial di benvenuto come visto.
// Segna vista anche la versione attuale delle "Novità": chi è appena arrivato ha
// già il tutorial, e una seconda finestra subito dopo racconterebbe "cosa è
// cambiato" a chi non ha mai visto il prima. Le Novità le vedrà dalla prossima uscita.
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  await db.update(users)
    .set({ tutorialVisto: true, novitaVista: ultimaVersione, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  await salvaSessioneUtente(event, { ...session.user, tutorialVisto: true, novitaVista: ultimaVersione })

  return { ok: true }
})
