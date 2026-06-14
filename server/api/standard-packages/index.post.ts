import { db } from '../../database/client'
import { standardPackages } from '../../database/schema'
import { z } from 'zod'

const CreateStandardPackageSchema = z.object({
  nome:        z.string().min(1).max(200).trim(),
  descrizione: z.string().max(500).optional().nullable(),
  tipo:        z.enum(['ORE', 'MENSILE', 'A_CONSUMO']),
  categoria:   z.string().min(1).max(100).trim(),
  oreIncluse:        z.number().positive().max(9999),
  giorniInclusi:     z.number().int().positive().max(365).optional().nullable(),
  orarioGiornaliero: z.number().positive().max(24).optional().nullable(),
  prezzoStandard:    z.number().nonnegative().max(99999),
  tariffaOraria:     z.number().positive().max(9999).optional().nullable(),
})

// POST /api/standard-packages — crea nuovo template
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const parsed = CreateStandardPackageSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi: ' + parsed.error.issues[0]?.message })
  }

  const d = parsed.data

  const [created] = await db.insert(standardPackages).values({
    nome:              d.nome,
    descrizione:       d.descrizione ?? null,
    tipo:              d.tipo,
    categoria:         d.categoria,
    oreIncluse:        String(d.oreIncluse),
    giorniInclusi:     d.giorniInclusi ?? null,
    orarioGiornaliero: d.orarioGiornaliero ? String(d.orarioGiornaliero) : null,
    tariffaOraria:     d.tariffaOraria ? String(d.tariffaOraria) : null,
    prezzoStandard:    String(d.prezzoStandard),
  }).returning()

  return created
})
