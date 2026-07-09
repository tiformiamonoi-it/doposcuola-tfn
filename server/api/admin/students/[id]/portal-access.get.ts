import { getPortalAccess } from '../../../../services/portal-user.service'

// GET /api/admin/students/:id/portal-access
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (!['ADMIN', 'SUPER_TUTOR'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'ID studente mancante' })

  try {
    return await getPortalAccess(studentId)
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: err.message?.includes('non trovato') ? 404 : 400, statusMessage: err.message })
  }
})
