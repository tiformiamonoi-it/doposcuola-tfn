import { db } from '../../database/client'
import { systemConfigs } from '../../database/schema'
import { inArray } from 'drizzle-orm'

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

  // Fallback se non configurate
  if (materie.length === 0) {
    materie = [
      'Matematica', 'Fisica', 'Chimica', 'Italiano', 'Inglese',
      'Storia', 'Geografia', 'Latino', 'Greco', 'Scienze', 'Informatica',
    ]
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
