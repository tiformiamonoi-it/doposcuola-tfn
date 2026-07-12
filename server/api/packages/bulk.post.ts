import { CreatePackageSchema } from '#shared/schemas/package.schema'
import { createPackage } from '../../services/package.service'
import { z } from 'zod'

const BulkPackageSchema = z.object({
  packages: z.array(CreatePackageSchema).min(1, 'Devi inserire almeno un pacchetto'),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_TUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const parsed = BulkPackageSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati bulk non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  // Creazione massiva in parallelo o sequenziale. Meglio sequenziale/parallela controllata per non caricare il DB.
  const results = []
  for (const pkgData of parsed.data.packages) {
    results.push(await createPackage(pkgData))
  }

  setResponseStatus(event, 201)
  return { success: true, count: results.length, data: results }
})
