import { CreateInteractionSchema } from '#shared/schemas/contact.schema'
import { addInteraction } from '../../../../services/contact.service'
import { toHttpError } from '../../../../utils/http-error'

// POST /api/contacts/:id/interactions
// Annota una chiamata/messaggio e, nella stessa transazione, può aggiornare
// stato e prossimo ricontatto del contatto (tutto-o-niente)
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID contatto mancante' })

  const body = await readBody(event)
  const parsed = CreateInteractionSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Dati interazione non validi',
      data: { errors: parsed.error.flatten().fieldErrors },
    })
  }

  try {
    const risultato = await addInteraction(id, parsed.data, user.id)
    setResponseStatus(event, 201)
    return { data: risultato }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw toHttpError(err, err.message?.includes('non trovat') ? 404 : 400)
  }
})
