import { db } from '../../database/client'
import { systemConfigs } from '../../database/schema'
import { inArray } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const rows = await db
    .select()
    .from(systemConfigs)
    .where(inArray(systemConfigs.key, ['materie', 'whatsapp_numero']))

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

  const whatsappRow = rows.find(r => r.key === 'whatsapp_numero')

  return {
    materie,
    whatsapp_numero: whatsappRow?.value || '',
  }
})
