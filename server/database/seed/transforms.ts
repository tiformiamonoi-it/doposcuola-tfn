/**
 * Decodificatori di campo (da stringa COPY → tipo atteso da Drizzle) e
 * trasformazioni riga-vecchia → oggetto pronto per db.insert, una per tabella.
 */

/** timestamp senza fuso ("2026-01-09 16:57:43.785") → Date, preservando il valore a parete (UTC). */
export function toDate(v: string | null): Date | null {
  if (v === null) return null
  return new Date(v.replace(' ', 'T') + 'Z')
}

/** Variante non-null per colonne NOT NULL (lancia se manca, così l'errore è esplicito). */
export function toDateReq(v: string | null): Date {
  const d = toDate(v)
  if (d === null) throw new Error('Timestamp obbligatorio mancante')
  return d
}

/** 't'/'f' → boolean. */
export function toBool(v: string | null): boolean {
  return v === 't'
}

/** Letterale array PostgreSQL "{Matematica,Fisica}" → ['Matematica','Fisica']. */
export function toArray(v: string | null): string[] {
  if (v === null || v === '{}') return []
  const inner = v.replace(/^\{|\}$/g, '')
  if (inner === '') return []
  // gestisce elementi opzionalmente racchiusi tra virgolette doppie
  return inner.match(/"([^"]*)"|[^,]+/g)?.map((e) => e.replace(/^"|"$/g, '')) ?? []
}
