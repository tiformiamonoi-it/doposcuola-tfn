import { runPackageAlerts } from '../../services/package-alerts.service'
import { anonymizeLostContacts } from '../../services/gdpr.service'
import { pulisciRateLimitScaduti } from '../../utils/rate-limit'

// GET /api/_cron/package-alerts — invocato ogni giorno da Vercel Cron (vercel.json).
// Oltre agli avvisi sui pacchetti fa anche la pulizia privacy dei contatti "Persi"
// da oltre 12 mesi: è l'unico appuntamento giornaliero, non serve un secondo cron.
// Il segreto CRON_SECRET lo controlla la auth-guard per tutto /api/_cron/.
export default defineEventHandler(async () => {
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

  // Stessa regola per i contatori dei tentativi scaduti: si riprova domani.
  let rateLimitCancellati = 0
  try {
    rateLimitCancellati = await pulisciRateLimitScaduti()
  } catch (err) {
    console.error('Pulizia dei contatori dei tentativi non riuscita:', err)
  }

  return { ...avvisi, contattiAnonimizzati, puliziaRiuscita, rateLimitCancellati }
})
