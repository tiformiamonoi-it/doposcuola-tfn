import { z } from 'zod'
import { getCategorie, getCategorieUsate, saveCategorie } from '../../../utils/categorie'
import { CATEGORIE_DEFAULT, CATEGORIE_SISTEMA, type Categoria } from '../../../../shared/accounting-categories'

const categoriaSchema = z.object({
  chiave:    z.string().optional().default(''),
  etichetta: z.string().min(1, 'Il nome della categoria è obbligatorio'),
  neutra:    z.boolean().optional().default(false),
  sistema:   z.boolean().optional().default(false),
})
const bodySchema = z.object({ categorie: z.array(categoriaSchema).min(1) })

// genera una chiave stabile da un nome (es. "Borse di studio" → "borse_di_studio")
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'categoria'
}

// PUT /api/accounting/categories — salva l'intera lista categorie.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN') throw createError({ statusCode: 403, statusMessage: 'Riservato agli ADMIN' })

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi', data: parsed.error.format() })
  }

  const sistemaSet = new Set<string>(CATEGORIE_SISTEMA)

  // Categorie utente in arrivo (le di sistema le ignoriamo: sono forzate ai default).
  const finali: Categoria[] = []
  for (const c of parsed.data.categorie) {
    if (sistemaSet.has(c.chiave)) continue // gestite dopo, forzate ai default
    let chiave = c.chiave || slugify(c.etichetta)
    // evita collisioni di chiave per le nuove categorie
    while (!c.chiave && (finali.some((f) => f.chiave === chiave) || sistemaSet.has(chiave))) {
      chiave += '_2'
    }
    finali.push({ chiave, etichetta: c.etichetta.trim(), neutra: !!c.neutra, sistema: false })
  }

  // Le categorie di sistema sono sempre presenti e non modificabili → forzate ai default.
  const sistema = CATEGORIE_DEFAULT.filter((c) => sistemaSet.has(c.chiave))
  const lista: Categoria[] = [...sistema, ...finali]

  // Protezione: non si può eliminare una categoria usata da movimenti esistenti.
  const chiaviFinali = new Set(lista.map((c) => c.chiave))
  const usateInDb = await getCategorieUsate()
  const mancanti = usateInDb.filter((k) => !chiaviFinali.has(k))
  if (mancanti.length > 0) {
    const correnti = await getCategorie()
    const nomi = mancanti.map((k) => correnti.find((c) => c.chiave === k)?.etichetta ?? k)
    throw createError({
      statusCode: 422,
      statusMessage: `Impossibile eliminare categorie con movimenti collegati: ${nomi.join(', ')}. Puoi solo rinominarle.`,
    })
  }

  await saveCategorie(lista)
  return lista
})
