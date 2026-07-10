import { runPackageAlerts } from '../../services/package-alerts.service'

// GET /api/_cron/package-alerts — invocato ogni giorno da Vercel Cron (vercel.json).
// Il path /api/_* è pubblico nella auth-guard, quindi qui serve una protezione propria:
// Vercel invia automaticamente "Authorization: Bearer $CRON_SECRET" alle invocazioni cron.
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    const secret = process.env.CRON_SECRET
    const auth = getHeader(event, 'authorization')
    if (!secret || auth !== `Bearer ${secret}`) {
      throw createError({ statusCode: 401, statusMessage: 'Non autorizzato' })
    }
  }

  return await runPackageAlerts()
})
