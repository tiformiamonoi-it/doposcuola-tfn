import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../database/client'
import { users } from '../../database/schema'
import { TERMS_VERSION, PRIVACY_STUDENTE_VERSION, CONSENSO_MINORE14_VERSION } from '#shared/legal'
import { dichiarazioniMinoriMancanti, impostaConsenso } from '../../services/consensi.service'
import { getLinkedStudentIds } from '../../utils/portal'

// POST /api/auth/accept-terms
// La schermata che si apre prima di entrare nel portale:
//  • GENITORE  → Termini + Informativa privacy, e (blocco 5) la dichiarazione di
//    autorizzazione per ciascun figlio che non ha ancora 14 anni;
//  • STUDENTE  → la sua informativa privacy in parole semplici.
//
// Le due cose arrivano insieme o separate: un genitore che ha già accettato i
// documenti mesi fa, ma che oggi iscrive un figlio di 11 anni, si ritrova questa
// schermata con la sola dichiarazione.
const AcceptTermsSchema = z.object({
  // Assente quando c'è solo da firmare la dichiarazione di un minore
  version: z.string().min(1).optional(),
  // Gli alunni per cui il genitore sta firmando l'autorizzazione
  dichiarazioni: z.array(z.string().min(1)).max(20).optional(),
}).refine(
  (d) => Boolean(d.version) || (d.dichiarazioni?.length ?? 0) > 0,
  { message: 'Non c\'è niente da accettare' },
)

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  if (!['GENITORE', 'STUDENTE'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Riservato a genitori e studenti' })
  }

  const result = AcceptTermsSchema.safeParse(await readBody(event))
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi' })
  }

  const eGenitore = session.user.role === 'GENITORE'
  let termsAccepted = session.user.termsAccepted === true

  if (result.data.version) {
    // La pagina mostrava una versione vecchia dei documenti: ricaricare
    const versioneAttesa = eGenitore ? TERMS_VERSION : PRIVACY_STUDENTE_VERSION
    if (result.data.version !== versioneAttesa) {
      throw createError({ statusCode: 409, statusMessage: 'Versione dei documenti non aggiornata: ricarica la pagina' })
    }

    await db.update(users)
      .set({ termsAcceptedAt: new Date(), termsAcceptedVersion: versioneAttesa, updatedAt: new Date() })
      .where(eq(users.id, session.user.id))

    termsAccepted = true
  }

  // ── Le dichiarazioni per i figli sotto i 14 anni ──
  const dichiarazioni = result.data.dichiarazioni ?? []
  if (dichiarazioni.length > 0) {
    if (!eGenitore) {
      throw createError({ statusCode: 403, statusMessage: 'L\'autorizzazione la dà il genitore' })
    }

    // Ogni alunno deve essere davvero suo: altrimenti basterebbe scrivere a mano
    // l'identificativo di un altro ragazzo per firmare al posto della sua famiglia.
    const suoi = await getLinkedStudentIds(session.user.id)
    for (const studentId of new Set(dichiarazioni)) {
      if (!suoi.includes(studentId)) {
        throw createError({ statusCode: 403, statusMessage: 'Questo alunno non è collegato al tuo account' })
      }
      // origine 'PORTALE': è la famiglia a dichiarare, e la segreteria lo vede
      // comparire sul campanellino senza doverlo andare a cercare.
      await impostaConsenso({
        tipo:          'MINORE_14',
        studentId,
        userId:        session.user.id,
        valore:        true,
        testoVersione: CONSENSO_MINORE14_VERSION,
        origine:       'PORTALE',
        attoreUserId:  session.user.id,
      })
    }
  }

  // Che cosa resta da firmare dopo questo giro: lo rileggiamo dal database invece
  // di dedurlo, così la sessione non può restare disallineata da quello che c'è.
  const dichiarazioniMinori = eGenitore
    ? await dichiarazioniMinoriMancanti(await getLinkedStudentIds(session.user.id))
    : undefined

  await salvaSessioneUtente(event, { ...session.user, termsAccepted, dichiarazioniMinori })

  return { ok: true }
})
