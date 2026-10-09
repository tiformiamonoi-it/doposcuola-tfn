import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../database/client'
import { users } from '../../database/schema'
import { versioniNote } from '#shared/changelog'

// POST /api/auth/novita-vista — la finestra "Novità" di questa versione è stata letta.
// Gemello di tutorial-visto: scrive nel database (vale su ogni dispositivo) e
// aggiorna la sessione, così la finestra non ricompare al prossimo caricamento.
// Accesso: il default STAFF di auth-policy (Admin, Super Tutor, Tutor); le famiglie no.
//
// La versione la manda il browser (è quella che ha mostrato davvero), ma deve
// essere una di quelle scritte in shared/changelog.ts: niente testo libero nel database.
const bodySchema = z.object({
  versione: z.string().refine(v => versioniNote.includes(v), 'Versione sconosciuta'),
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { versione } = await readValidatedBody(event, bodySchema.parse)

  await db.update(users)
    .set({ novitaVista: versione, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  await salvaSessioneUtente(event, { ...session.user, novitaVista: versione })

  return { ok: true }
})
