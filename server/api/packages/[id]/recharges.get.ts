import { getPackageRecharges } from '../../../services/package.service'
import { isTutorRole } from '../../../utils/package-privacy'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID mancante' })

  // Storico economico: precluso ai TUTOR anche in lettura
  const { user } = await requireUserSession(event)
  if (isTutorRole(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso non consentito per il tuo ruolo' })
  }

  const rows = await getPackageRecharges(id)
  return { data: rows }
})
