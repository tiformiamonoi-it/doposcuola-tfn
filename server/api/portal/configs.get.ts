import { db } from '../../database/client'
import { systemConfigs } from '../../database/schema'
import { inArray } from 'drizzle-orm'
import { MATERIE_DEFAULT } from '#shared/materie'

export default defineEventHandler(async () => {
  const rows = await db
    .select()
    .from(systemConfigs)
    .where(inArray(systemConfigs.key, ['materie', 'whatsapp_numero', 'materie_speciali', 'giornate_speciali']))

  const materieRow = rows.find(r => r.key === 'materie')
  let materie: string[] = []
  try {
    materie = JSON.parse(materieRow?.value || '[]')
    if (!Array.isArray(materie)) materie = []
  } catch {
    materie = []
  }

  // Fallback se non configurate. La lista NON si riscrive qui: fino a ieri questa
  // riga era una copia a mano di MATERIE_DEFAULT, e due copie della stessa cosa
  // prima o poi divergono in silenzio — il portale avrebbe mostrato alle famiglie
  // materie diverse da quelle del gestionale senza che nessuno se ne accorgesse.
  // Una sola fonte: #shared/materie.
  if (materie.length === 0) {
    materie = [...MATERIE_DEFAULT]
  }

  // Materie speciali + calendario unico delle giornate (per prenotazione e home portale)
  let materieSpeciali: string[] = []
  try {
    const v = JSON.parse(rows.find(r => r.key === 'materie_speciali')?.value || '[]')
    if (Array.isArray(v)) materieSpeciali = v
  } catch { /* nessuna materia speciale */ }

  // Calendario giornate speciali: 'YYYY-MM-DD' → array di materie (tollera il vecchio formato stringa)
  const giornateSpeciali: Record<string, string[]> = {}
  try {
    const v = JSON.parse(rows.find(r => r.key === 'giornate_speciali')?.value || '{}')
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [data, materie] of Object.entries(v)) {
        giornateSpeciali[data] = Array.isArray(materie)
          ? materie.filter((x): x is string => typeof x === 'string')
          : (typeof materie === 'string' && materie ? [materie] : [])
      }
    }
  } catch { /* nessuna giornata configurata */ }

  const whatsappRow = rows.find(r => r.key === 'whatsapp_numero')

  return {
    materie,
    materie_speciali: materieSpeciali,
    giornate_speciali: giornateSpeciali,
    whatsapp_numero: whatsappRow?.value || '',
  }
})
