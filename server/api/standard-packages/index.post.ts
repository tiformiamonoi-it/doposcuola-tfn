import { db } from '../../database/client'
import { standardPackages } from '../../database/schema'
// Le regole di validazione ora vivono in shared/schemas: le stesse identiche regole valgono
// anche per la modifica (PUT), così creare e correggere un modello non possono divergere.
import { CreateStandardPackageSchema } from '#shared/schemas/standard-package.schema'

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
