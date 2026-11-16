import { db } from '../../../database/client'
import { systemConfigs } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const configs = await db.select().from(systemConfigs)
  
  // Transform array into an object mapping key -> value
  const result: Record<string, string> = {}
  for (const c of configs) {
    // Le spese fisse sono contabilità riservata: le vede (e le usa, in Impostazioni) solo l'ADMIN
    if (c.key === 'spese_fisse' && user.role !== 'ADMIN') continue
    // Righe con foto dentro, che la pagina Impostazioni non usa: non si mandano, sono pesanti.
    // 'sconti' è la vecchia copia delle convenzioni (ora nella tabella convenzioni, migrazione 0039);
    // l'altra è la foto dell'ultima prova di comunicazione.
    if (c.key === 'sconti' || c.key === 'comunicazione_prova_immagine') continue
    result[c.key] = c.value
  }
  return result
})
