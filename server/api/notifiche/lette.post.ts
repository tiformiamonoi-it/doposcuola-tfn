import { segnaTutteLette } from '../../services/notifiche.service'
import { toHttpError } from '../../utils/http-error'

// POST /api/notifiche/lette — segna come lette TUTTE le notifiche aperte.
//
// Il percorso è '/api/notifiche/lette' (una sola parola dopo notifiche) mentre
// quello della singola è '/api/notifiche/:id/letta' (due): non si sovrappongono,
// e a parità di forma Nitro fa comunque vincere il percorso fisso su quello con
// il parametro.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  try {
    return await segnaTutteLette(user.id)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err)
  }
})
