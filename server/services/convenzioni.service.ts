// LE CONVENZIONI (tabella `convenzioni`, migrazione 0039): gestione da Impostazioni →
// Sconti e lettura per il portale. La foto non esce mai negli elenchi: al suo posto
// l'indirizzo pubblico /api/immagini/convenzioni/<id> (vedi shared/convenzioni.ts).
import { asc, eq, gte, isNull, or, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { convenzioni } from '../database/schema'
import { nonTrovato } from '../utils/http-error'
import type { Convenzione } from '#shared/convenzioni'
import type { ConvenzioneInput } from '#shared/schemas/convenzione.schema'

const CAMPI = {
  id:          convenzioni.id,
  nome:        convenzioni.nome,
  descrizione: convenzioni.descrizione,
  categoria:   convenzioni.categoria,
  citta:       convenzioni.citta,
  sconto:      convenzioni.sconto,
  indirizzo:   convenzioni.indirizzo,
  orari:       convenzioni.orari,
  telefono:    convenzioni.telefono,
  validaFino:  convenzioni.validaFino,
  creataAt:    convenzioni.creataAt,
  updatedAt:   convenzioni.updatedAt,
  conImmagine: sql<boolean>`${convenzioni.immagine} is not null`,
}

// Dalla riga all'oggetto per portale e Impostazioni: il "c'è la foto" diventa l'indirizzo.
// ?v= cambia a ogni correzione: una foto sostituita non resta vecchia nella cache del browser.
function perElenco({ conImmagine, updatedAt, ...r }: { conImmagine: boolean; updatedAt: Date } & Omit<Convenzione, 'foto'> & { creataAt: Date | null }) {
  return { ...r, foto: conImmagine ? `/api/immagini/convenzioni/${r.id}?v=${updatedAt.getTime()}` : null }
}

// Ordine: quelle senza data (le più vecchie, copiate dal JSON) prima, poi per data di
// aggiunta. È l'ordine in cui le vedevano le famiglie quando stavano nel JSON.
const ORDINE = [sql`${convenzioni.creataAt} asc nulls first`, asc(convenzioni.nome)]

/** Tutte, anche le scadute: per Impostazioni, che le segna in rosso */
export async function elencoConvenzioni() {
  return (await db.select(CAMPI).from(convenzioni).orderBy(...ORDINE)).map(perElenco)
}

/** Solo quelle valide oggi (`oggi` = giorno italiano): per il portale e le notifiche */
export async function convenzioniValide(oggi: string) {
  return (await db.select(CAMPI).from(convenzioni)
    .where(or(isNull(convenzioni.validaFino), gte(convenzioni.validaFino, oggi)))
    .orderBy(...ORDINE)).map(perElenco)
}

export async function creaConvenzione(input: ConvenzioneInput) {
  const [r] = await db.insert(convenzioni)
    .values({ ...input, immagine: input.immagine ?? null })
    .returning({ id: convenzioni.id })
  return r!
}

// "Correggi": creataAt NON si tocca, una correzione non è una convenzione nuova (il
// riepilogo serale non deve riannunciarla). Foto: assente = resta, null = si toglie.
export async function modificaConvenzione(id: string, input: ConvenzioneInput) {
  const { immagine, ...resto } = input
  const [r] = await db.update(convenzioni)
    .set({ ...resto, ...(immagine !== undefined ? { immagine } : {}), updatedAt: new Date() })
    .where(eq(convenzioni.id, id))
    .returning({ id: convenzioni.id })
  if (!r) throw nonTrovato('Convenzione non trovata')
  return r
}

export async function eliminaConvenzione(id: string) {
  const [r] = await db.delete(convenzioni).where(eq(convenzioni.id, id)).returning({ id: convenzioni.id })
  if (!r) throw nonTrovato('Convenzione non trovata')
  return { ok: true }
}

/** La foto, per l'indirizzo pubblico /api/immagini/convenzioni/<id>; null se non c'è */
export async function immagineConvenzione(id: string): Promise<string | null> {
  const [r] = await db.select({ immagine: convenzioni.immagine }).from(convenzioni).where(eq(convenzioni.id, id)).limit(1)
  return r?.immagine ?? null
}
