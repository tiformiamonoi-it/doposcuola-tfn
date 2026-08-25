import { runPackageAlerts } from '../../services/package-alerts.service'
import { anonymizeLostContacts } from '../../services/gdpr.service'

// GET /api/_cron/package-alerts — invocato ogni giorno da Vercel Cron (vercel.json).
// Oltre agli avvisi sui pacchetti fa anche la pulizia privacy dei contatti "Persi"
// da oltre 12 mesi: è l'unico appuntamento giornaliero, non serve un secondo cron.
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

  const avvisi = await runPackageAlerts()

  // La pulizia privacy non deve mai far fallire gli avvisi: se va storta si registra
  // nel log del server e il giro successivo riproverà.
  let contattiAnonimizzati = 0
  let puliziaRiuscita = true
  try {
    contattiAnonimizzati = await anonymizeLostContacts()
  } catch (err) {
    puliziaRiuscita = false
    console.error('Pulizia privacy dei contatti persi non riuscita:', err)
  }

  return { ...avvisi, contattiAnonimizzati, puliziaRiuscita }
})
