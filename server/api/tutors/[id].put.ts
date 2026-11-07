import { UpdateTutorSchema } from '#shared/schemas/tutor.schema'
import { updateTutor } from '../../services/tutor.service'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = UpdateTutorSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  const { user } = await requireUserSession(event)

  // IL SUPER TUTOR SUL PROPRIO PROFILO: può correggere i suoi dati personali e le
  // materie, ma NON ruolo, stato, email, password, note interne né compenso (fisso,
  // modalità): altrimenti potrebbe alzarsi il fisso da solo. La scheda rimanda tutti i
  // campi a ogni salvataggio, quindi quelli non ammessi si scartano invece di dare errore.
  // (La password se la cambia da "Cambia password", l'email gliela corregge l'admin.)
  if (user.role !== 'ADMIN' && id === user.id) {
    const d = parsed.data
    const ammessi = {
      firstName: d.firstName, lastName: d.lastName, phone: d.phone, dataNascita: d.dataNascita,
      indirizzo: d.indirizzo, citta: d.citta, cap: d.cap, codiceFiscale: d.codiceFiscale,
      partitaIva: d.partitaIva, materie: d.materie, sempreDisponibile: d.sempreDisponibile,
    }
    const soloDefiniti = Object.fromEntries(Object.entries(ammessi).filter(([, v]) => v !== undefined))
    const result = await updateTutor(id, soloDefiniti, user.role, true)
    if (!result) throw createError({ statusCode: 404, statusMessage: 'Tutor non trovato' })
    return result
  }

  const targetRole = parsed.data.role

  // Protezione escalation ruolo: solo l'ADMIN può assegnare ruoli elevati
  // (SUPER_TUTOR può gestire i tutor ma non promuovere nessuno)
  if (targetRole && targetRole !== 'TUTOR' && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Solo l\'Admin può assegnare i ruoli Super Tutor e Admin' })
  }

  // Il ruolo di chi chiama limita anche QUALI account può modificare (404 se non gestibile)
  const result = await updateTutor(id, parsed.data, user.role)
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Tutor non trovato' })

  return result
})
