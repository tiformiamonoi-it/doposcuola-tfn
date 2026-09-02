// Sezione Rientri (conferme di inizio anno) — liste fisse, etichette italiane e colori.
// UNICA FONTE per server e frontend: i `value` devono restare allineati all'enum
// Postgres `confirmation_status` definito in server/database/schema/common.ts.

type Voce<T extends string> = { readonly value: T; readonly label: string }
type VoceColorata<T extends string> = Voce<T> & { readonly color: string }

// ─────────────────────────────────────────────
// STATO DEL RIENTRO (le quattro risposte dell'appello)
// `color` sono i colori del tema Nuxt UI
// ─────────────────────────────────────────────
export const STATI_RIENTRO = [
  { value: 'DA_SENTIRE', label: 'Da sentire', color: 'neutral' },
  { value: 'CONFERMATO', label: 'Confermato', color: 'success' },
  { value: 'IN_FORSE',   label: 'In forse',   color: 'warning' },
  { value: 'NON_TORNA',  label: 'Non torna',  color: 'error' },
] as const satisfies ReadonlyArray<VoceColorata<string>>

export type StatoRientro = (typeof STATI_RIENTRO)[number]['value']

// Elenco dei soli valori — serve a z.enum() negli schemi Zod
export const VALORI_STATO_RIENTRO = STATI_RIENTRO.map((v) => v.value) as [StatoRientro, ...StatoRientro[]]

export const labelStatoRientro = (v: string | null | undefined): string =>
  STATI_RIENTRO.find((s) => s.value === v)?.label ?? '—'

export const colorStatoRientro = (v: string | null | undefined): string =>
  STATI_RIENTRO.find((s) => s.value === v)?.color ?? 'neutral'

// ─────────────────────────────────────────────
// ANNO SCOLASTICO
// Funzioni pure: nessuna lettura dell'orologio, nessun fuso orario di mezzo.
// Le date-giorno sono sempre testo 'AAAA-MM-GG'.
// ─────────────────────────────────────────────

/** Agosto: da qui in poi si parla già dell'anno scolastico che deve cominciare. */
const MESE_INIZIO_CAMPAGNA = 8

/**
 * Anno scolastico a cui appartiene un giorno civile.
 * Da AGOSTO in poi si è già nell'anno che comincia ('2026-08-25' → '2026/2027'),
 * perché è ad agosto che si comincia a chiamare le famiglie; da gennaio a luglio
 * si è ancora in quello iniziato l'anno prima ('2026-03-01' → '2025/2026').
 * Il mese di stacco è lo stesso da cui parte la campagna (vedi `inizioCampagna`).
 */
export function annoScolasticoDa(giornoISO: string): string {
  const anno = Number(giornoISO.slice(0, 4))
  const mese = Number(giornoISO.slice(5, 7))
  if (!anno || !mese) return ''
  return mese >= MESE_INIZIO_CAMPAGNA ? `${anno}/${anno + 1}` : `${anno - 1}/${anno}`
}

/** Anno di partenza di '2026/2027' → 2026. */
export function annoDiPartenza(anno: string): number {
  return Number(anno.slice(0, 4))
}

/**
 * Data proposta per il primo giorno di lezione: il LUNEDÌ della settimana di
 * calendario che contiene il 15 settembre dell'anno di partenza.
 * (Per il 2026 dà lunedì 14/09/2026.)
 * È solo una proposta: in Impostazioni si può correggere a mano.
 */
export function inizioAnnoProposto(anno: string): string {
  const y = annoDiPartenza(anno)
  if (!y) return ''
  // Calcolo in UTC: nessuno sfasamento da ora legale
  const quindici = new Date(Date.UTC(y, 8, 15))
  // getUTCDay(): 0 = domenica, 1 = lunedì … quanti giorni indietro fino al lunedì
  const indietro = (quindici.getUTCDay() + 6) % 7
  const lunedi = new Date(Date.UTC(y, 8, 15 - indietro))
  const mm = String(lunedi.getUTCMonth() + 1).padStart(2, '0')
  const gg = String(lunedi.getUTCDate()).padStart(2, '0')
  return `${lunedi.getUTCFullYear()}-${mm}-${gg}`
}

/**
 * Inizio della "campagna rientri" di un anno scolastico: il 1° agosto dell'anno
 * di partenza. Da lì in poi un contatto convertito in alunno conta come nuovo
 * iscritto dell'anno ('2026/2027' → '2026-08-01').
 */
export function inizioCampagna(anno: string): string {
  const y = annoDiPartenza(anno)
  return y ? `${y}-${String(MESE_INIZIO_CAMPAGNA).padStart(2, '0')}-01` : ''
}
