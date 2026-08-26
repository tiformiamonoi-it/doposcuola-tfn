// Sezione Contatti (mini-CRM) — liste fisse, etichette italiane e colori.
// UNICA FONTE per server e frontend: i `value` devono restare allineati agli enum
// Postgres definiti in server/database/schema/common.ts.

type Voce<T extends string> = { readonly value: T; readonly label: string }
type VoceColorata<T extends string> = Voce<T> & { readonly color: string }

// ─────────────────────────────────────────────
// TIPO (le due tab)
// ─────────────────────────────────────────────
export const TIPI_CONTATTO = [
  { value: 'DOPOSCUOLA', label: 'Doposcuola' },
  { value: 'MARKETING',  label: 'Marketing' },
] as const satisfies ReadonlyArray<Voce<string>>

export type TipoContatto = (typeof TIPI_CONTATTO)[number]['value']

// ─────────────────────────────────────────────
// CANALE / FONTE (da dove ci ha conosciuto)
// ─────────────────────────────────────────────
export const CANALI_CONTATTO = [
  { value: 'INSTAGRAM',   label: 'Instagram' },
  { value: 'FACEBOOK',    label: 'Facebook' },
  { value: 'TIKTOK',      label: 'TikTok' },
  { value: 'WHATSAPP',    label: 'WhatsApp' },
  { value: 'TELEFONO',    label: 'Telefono' },
  { value: 'SITO_WEB',    label: 'Sito web' },
  { value: 'EMAIL',       label: 'Email' },
  { value: 'PASSAPAROLA', label: 'Passaparola' },
  { value: 'META_ADS',    label: 'Meta Ads' },
  { value: 'GOOGLE_ADS',  label: 'Google Ads' },
  { value: 'ALTRO',       label: 'Altro' },
] as const satisfies ReadonlyArray<Voce<string>>

export type CanaleContatto = (typeof CANALI_CONTATTO)[number]['value']

// ─────────────────────────────────────────────
// STATO (il percorso del contatto) — `color` sono i colori del tema Nuxt UI
// ─────────────────────────────────────────────
export const STATI_CONTATTO = [
  { value: 'NUOVO',           label: 'Nuovo',           color: 'info' },
  { value: 'DA_RICONTATTARE', label: 'Da ricontattare', color: 'warning' },
  { value: 'IN_TRATTATIVA',   label: 'In trattativa',   color: 'primary' },
  { value: 'CONVERTITO',      label: 'Convertito',      color: 'success' },
  { value: 'PERSO',           label: 'Perso',           color: 'neutral' },
] as const satisfies ReadonlyArray<VoceColorata<string>>

export type StatoContatto = (typeof STATI_CONTATTO)[number]['value']

// Stati "chiusi": un contatto convertito o perso non va più ricontattato
export const STATI_CHIUSI: readonly StatoContatto[] = ['CONVERTITO', 'PERSO']

// ─────────────────────────────────────────────
// RUOLO MARKETING (solo tab Marketing)
// ─────────────────────────────────────────────
export const RUOLI_MARKETING = [
  { value: 'CLIENTE', label: 'Cliente (interessato ai nostri servizi)' },
  { value: 'PARTNER', label: 'Partner (collaborazione)' },
] as const satisfies ReadonlyArray<Voce<string>>

export type RuoloMarketing = (typeof RUOLI_MARKETING)[number]['value']

// ─────────────────────────────────────────────
// CHI È (solo tab Doposcuola)
// Nella stessa tab arrivano famiglie interessate e candidati che vogliono
// lavorare come tutor: questo campo li tiene distinti.
// ─────────────────────────────────────────────
export const RUOLI_DOPOSCUOLA = [
  { value: 'STUDENTE', label: 'Possibile studente' },
  { value: 'TUTOR',    label: 'Possibile tutor' },
] as const satisfies ReadonlyArray<Voce<string>>

export type RuoloDoposcuola = (typeof RUOLI_DOPOSCUOLA)[number]['value']

// ─────────────────────────────────────────────
// INTERAZIONI (il diario)
// ─────────────────────────────────────────────
export const TIPI_INTERAZIONE = [
  { value: 'CHIAMATA',  label: 'Chiamata' },
  { value: 'MESSAGGIO', label: 'Messaggio' },
  { value: 'EMAIL',     label: 'Email' },
  { value: 'INCONTRO',  label: 'Incontro' },
  { value: 'ALTRO',     label: 'Altro' },
] as const satisfies ReadonlyArray<Voce<string>>

export type TipoInterazione = (typeof TIPI_INTERAZIONE)[number]['value']

export const DIREZIONI_INTERAZIONE = [
  { value: 'RICEVUTA',   label: 'Ricevuta (ci ha contattato)' },
  { value: 'EFFETTUATA', label: 'Effettuata (lo abbiamo contattato)' },
] as const satisfies ReadonlyArray<Voce<string>>

export type DirezioneInterazione = (typeof DIREZIONI_INTERAZIONE)[number]['value']

export const ESITI_INTERAZIONE = [
  { value: 'RISPOSTO',         label: 'Risposto',         color: 'success' },
  { value: 'NESSUNA_RISPOSTA', label: 'Nessuna risposta', color: 'neutral' },
  { value: 'DA_RICHIAMARE',    label: 'Da richiamare',    color: 'warning' },
] as const satisfies ReadonlyArray<VoceColorata<string>>

export type EsitoInterazione = (typeof ESITI_INTERAZIONE)[number]['value']

// ─────────────────────────────────────────────
// Elenchi dei soli valori — servono a z.enum() negli schemi Zod
// ─────────────────────────────────────────────
function valori<T extends string>(lista: ReadonlyArray<Voce<T>>): [T, ...T[]] {
  return lista.map((v) => v.value) as [T, ...T[]]
}

export const VALORI_TIPO_CONTATTO       = valori(TIPI_CONTATTO)
export const VALORI_CANALE_CONTATTO     = valori(CANALI_CONTATTO)
export const VALORI_STATO_CONTATTO      = valori(STATI_CONTATTO)
export const VALORI_RUOLO_MARKETING     = valori(RUOLI_MARKETING)
export const VALORI_RUOLO_DOPOSCUOLA    = valori(RUOLI_DOPOSCUOLA)
export const VALORI_TIPO_INTERAZIONE    = valori(TIPI_INTERAZIONE)
export const VALORI_DIREZIONE_INTERAZIONE = valori(DIREZIONI_INTERAZIONE)
export const VALORI_ESITO_INTERAZIONE   = valori(ESITI_INTERAZIONE)

// ─────────────────────────────────────────────
// Etichette e colori (fallback '—' per valori sconosciuti/vuoti)
// ─────────────────────────────────────────────
function etichetta<T extends string>(lista: ReadonlyArray<Voce<T>>, value: string | null | undefined): string {
  return lista.find((v) => v.value === value)?.label ?? '—'
}

export const labelTipo            = (v: string | null | undefined) => etichetta(TIPI_CONTATTO, v)
export const labelCanale          = (v: string | null | undefined) => etichetta(CANALI_CONTATTO, v)
export const labelStato           = (v: string | null | undefined) => etichetta(STATI_CONTATTO, v)
export const labelRuoloMarketing  = (v: string | null | undefined) => etichetta(RUOLI_MARKETING, v)
export const labelRuoloDoposcuola = (v: string | null | undefined) => etichetta(RUOLI_DOPOSCUOLA, v)
export const labelTipoInterazione = (v: string | null | undefined) => etichetta(TIPI_INTERAZIONE, v)
export const labelDirezione       = (v: string | null | undefined) => etichetta(DIREZIONI_INTERAZIONE, v)
export const labelEsito           = (v: string | null | undefined) => etichetta(ESITI_INTERAZIONE, v)

export const colorStato = (v: string | null | undefined): string =>
  STATI_CONTATTO.find((s) => s.value === v)?.color ?? 'neutral'

export const colorEsito = (v: string | null | undefined): string =>
  ESITI_INTERAZIONE.find((e) => e.value === v)?.color ?? 'neutral'
