import { getCentroNotifiche } from '../../services/notifiche.service'
import { toHttpError } from '../../utils/http-error'

// GET /api/notifiche
// Tutto il contenuto del campanellino in una chiamata sola: le notifiche non
// lette, le ultime già lette (per lo storico breve) e i compleanni di oggi e
// domani calcolati al volo.
//
// Riservato ad ADMIN/SUPER_TUTOR (regola in server/utils/auth-policy.ts): dentro
// ci sono nomi di alunni e numeri di telefono dei genitori — dati che ai TUTOR
// non servono e che il gestionale non mostra loro da nessun'altra parte.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  // Cintura e bretelle: la policy già blocca i tutor, ma questo endpoint viene
  // chiamato dal menu che sta in cima a OGNI pagina, anche la loro. Rispondere
  // "vuoto" invece che con un errore evita di riempire la console di 403 inutili.
  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    return { nonLette: [], ultimeLette: [], compleanni: [], numeroNonLette: 0 }
  }

  try {
    return await getCentroNotifiche()
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
