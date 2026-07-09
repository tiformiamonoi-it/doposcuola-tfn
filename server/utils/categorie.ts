import { db } from '../database/client'
import { systemConfigs, accountingEntries } from '../database/schema'
import { eq, isNotNull } from 'drizzle-orm'
import { CATEGORIE_DEFAULT, type Categoria } from '../../shared/accounting-categories'

const KEY = 'categorie_contabili'

/** Lista salvata in configurazione (o i default se mai impostata). */
async function getCategorieSalvate(): Promise<Categoria[]> {
  const [row] = await db.select().from(systemConfigs).where(eq(systemConfigs.key, KEY)).limit(1)
  if (!row) return CATEGORIE_DEFAULT
  try {
    const parsed = JSON.parse(row.value) as Categoria[]
    return Array.isArray(parsed) && parsed.length ? parsed : CATEGORIE_DEFAULT
  } catch {
    return CATEGORIE_DEFAULT
  }
}

/**
 * Lista completa = categorie salvate + eventuali categorie già presenti sui movimenti
 * ma non ancora in elenco (es. vecchie importazioni: "Affitto", "Utenze"…).
 * Così nessun movimento resta "orfano" senza etichetta.
 */
export async function getCategorie(): Promise<Categoria[]> {
  const salvate = await getCategorieSalvate()
  const presenti = new Set(salvate.map((c) => c.chiave))

  const usate = await db
    .selectDistinct({ categoria: accountingEntries.categoria })
    .from(accountingEntries)
    .where(isNotNull(accountingEntries.categoria))

  const extra: Categoria[] = usate
    .map((r) => r.categoria!)
    .filter((k) => k && !presenti.has(k))
    .map((k) => ({ chiave: k, etichetta: k, neutra: false, sistema: false }))

  return [...salvate, ...extra]
}

/** Chiavi delle categorie neutre (escluse dal margine). */
export async function getNeutralKeys(): Promise<string[]> {
  return (await getCategorie()).filter((c) => c.neutra).map((c) => c.chiave)
}

/** Chiavi categoria effettivamente usate da almeno un movimento. */
export async function getCategorieUsate(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ categoria: accountingEntries.categoria })
    .from(accountingEntries)
    .where(isNotNull(accountingEntries.categoria))
  return rows.map((r) => r.categoria!).filter(Boolean)
}

export async function saveCategorie(list: Categoria[]) {
  const value = JSON.stringify(list)
  const [existing] = await db.select().from(systemConfigs).where(eq(systemConfigs.key, KEY)).limit(1)
  if (existing) {
    await db.update(systemConfigs).set({ value, updatedAt: new Date() }).where(eq(systemConfigs.key, KEY))
  } else {
    await db.insert(systemConfigs).values({ key: KEY, value })
  }
}
