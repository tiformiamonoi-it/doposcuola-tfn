import { db } from '../../database/client'
import { standardPackages } from '../../database/schema'
import { eq } from 'drizzle-orm'
import { UpdateStandardPackageSchema } from '#shared/schemas/standard-package.schema'

// PUT /api/standard-packages/:id — corregge un MODELLO del listino (solo ADMIN)
//
// PERCHE' esiste: fino a ieri un modello si poteva creare e archiviare, ma non correggere.
// Sbagliavi un prezzo e dovevi archiviare il modello e rifarlo da capo, lasciandoti dietro
// un doppione nell'elenco degli archiviati.
//
// PERCHE' NON tocca i pacchetti già venduti: alla vendita il pacchetto COPIA dentro di sé
// nome, ore e prezzo del modello (vedi `applicaTemplate` nella finestra di creazione) e del
// modello conserva solo un riferimento. Quindi qui si cambia il listino da domani in avanti,
// mentre quello che una famiglia ha già firmato e pagato resta esattamente com'era: se così
// non fosse, correggere un prezzo riscriverebbe all'indietro la contabilità.
export default defineEventHandler(async (event) => {
  // La policy generale (server/utils/auth-policy.ts) apre /api/standard-packages anche al
  // SUPER_TUTOR, che infatti deve poter LEGGERE i modelli per vendere i pacchetti. La
  // modifica del listino però è una decisione economica: la stringiamo qui all'ADMIN.
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Solo l\'amministratore può modificare i modelli di pacchetto: chiedi a lui la correzione.',
    })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID mancante' })
  }

  const body = await readBody(event)

  const parsed = UpdateStandardPackageSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Dati non validi: ' + parsed.error.issues[0]?.message })
  }

  const d = parsed.data

  // Si aggiorna SOLO ciò che è arrivato davvero: `undefined` significa "non toccare questo
  // campo", `null` significa invece "svuotalo". Sono due cose diverse e vanno tenute distinte,
  // altrimenti un corpo parziale azzererebbe di nascosto i campi che non contiene.
  const patch: Partial<typeof standardPackages.$inferInsert> = { updatedAt: new Date() }

  if (d.nome        !== undefined) patch.nome        = d.nome
  if (d.descrizione !== undefined) patch.descrizione = d.descrizione ?? null
  if (d.tipo        !== undefined) patch.tipo        = d.tipo
  if (d.categoria   !== undefined) patch.categoria   = d.categoria

  // I campi numerici del database sono `numeric`: Drizzle li vuole come stringa, per non
  // perdere centesimi per strada come farebbe un numero a virgola mobile.
  if (d.oreIncluse     !== undefined) patch.oreIncluse     = String(d.oreIncluse)
  if (d.prezzoStandard !== undefined) patch.prezzoStandard = String(d.prezzoStandard)
  if (d.giorniInclusi     !== undefined) patch.giorniInclusi     = d.giorniInclusi ?? null
  if (d.orarioGiornaliero !== undefined) patch.orarioGiornaliero = d.orarioGiornaliero == null ? null : String(d.orarioGiornaliero)
  if (d.tariffaOraria     !== undefined) patch.tariffaOraria     = d.tariffaOraria == null ? null : String(d.tariffaOraria)

  // Nessun filtro su `active`: un modello archiviato resta modificabile di proposito, così
  // lo si sistema PRIMA di rimetterlo in elenco invece di ripristinarlo sbagliato.
  const [updated] = await db
    .update(standardPackages)
    .set(patch)
    .where(eq(standardPackages.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Modello di pacchetto non trovato' })
  }

  return updated
})
