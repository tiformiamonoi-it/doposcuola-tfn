// Sezione Contatti — solo ciò che serve all'interfaccia.
// Etichette, colori e liste di valori stanno in shared/contatti.ts (unica fonte,
// condivisa col server): qui le trasformiamo nel formato { label, value } che
// vogliono i USelect e aggiungiamo qualche aiuto di formattazione.

import {
  STATI_CONTATTO,
  CANALI_CONTATTO,
  RUOLI_MARKETING,
  RUOLI_DOPOSCUOLA,
  TIPI_INTERAZIONE,
  DIREZIONI_INTERAZIONE,
  ESITI_INTERAZIONE,
  STATI_CHIUSI,
  colorStato,
  colorEsito,
} from '#shared/contatti'
import type {
  TipoContatto,
  CanaleContatto,
  StatoContatto,
  RuoloMarketing,
  RuoloDoposcuola,
  TipoInterazione,
  DirezioneInterazione,
  EsitoInterazione,
} from '#shared/contatti'
import { normalizzaTelefono } from '#shared/phone'
import { oggiISO } from './format'

// ─────────────────────────────────────────────
// FORMA DEI DATI CHE ARRIVANO DAGLI SPORTELLI
// (le date viaggiano come testo: il JSON non ha un tipo "data")
// ─────────────────────────────────────────────

export interface Contatto {
  id: string
  tipo: TipoContatto
  nome: string
  cognome: string | null
  telefono: string | null
  email: string | null
  /** Link al profilo o @nomeutente: per chi scrive solo in chat social */
  socialLink: string | null
  canaleOrigine: CanaleContatto
  stato: StatoContatto
  prossimoRicontatto: string | null
  ultimoContattoAt: string | null
  note: string | null
  nomeStudente: string | null
  classeScuola: string | null
  materie: string | null
  azienda: string | null
  servizioInteresse: string | null
  marketingRuolo: RuoloMarketing | null
  /** Solo Doposcuola: famiglia interessata o candidato tutor */
  doposcuolaRuolo: RuoloDoposcuola
  privacyInformata: boolean
  studentId: string | null
  contactRequestId: string | null
  createdByUserId: string | null
  convertitoAt: string | null
  archiviatoAt: string | null
  // Valorizzata dalla pulizia GDPR: i dati personali sono stati cancellati
  anonimizzatoAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Interazione {
  id: string
  contactId: string
  tipo: TipoInterazione
  direzione: DirezioneInterazione
  canale: CanaleContatto
  esito: EsitoInterazione | null
  note: string | null
  data: string
  createdAt: string
  autoreNome: string | null
}

export interface ContattoDettaglio extends Contatto {
  studenteNome: string | null
  creatoDaNome: string | null
  interazioni: Interazione[]
}

export interface KpiContatti {
  nuovi: number
  daRicontattareOggi: number
  inTrattativa: number
  convertitiMese: number
  totaleDoposcuola: number
  totaleMarketing: number
  /** Quanti Doposcuola sono candidati tutor (non archiviati) */
  totaleTutorDoposcuola: number
}

// ─────────────────────────────────────────────
// LISTE PER I MENU A TENDINA
// ─────────────────────────────────────────────

type Voce = { label: string; value: string }

const aItems = (lista: ReadonlyArray<{ value: string; label: string }>): Voce[] =>
  lista.map((v) => ({ label: v.label, value: v.value }))

export const STATI_ITEMS      = aItems(STATI_CONTATTO)
export const CANALI_ITEMS     = aItems(CANALI_CONTATTO)
export const RUOLI_MARKETING_ITEMS   = aItems(RUOLI_MARKETING)
export const RUOLI_DOPOSCUOLA_ITEMS  = aItems(RUOLI_DOPOSCUOLA)
export const TIPI_INTERAZIONE_ITEMS  = aItems(TIPI_INTERAZIONE)
export const DIREZIONI_ITEMS         = aItems(DIREZIONI_INTERAZIONE)
export const ESITI_ITEMS             = aItems(ESITI_INTERAZIONE)

// I menu a tendina di Nuxt UI non accettano il valore vuoto '': per dire
// "nessun filtro" / "non specificato" servono due parole-segnaposto.
export const NESSUN_FILTRO   = 'TUTTI'
export const NON_SPECIFICATO = 'NESSUNO'

export const STATI_FILTRO_ITEMS  = [{ label: 'Stato: tutti', value: NESSUN_FILTRO }, ...STATI_ITEMS]
export const CANALI_FILTRO_ITEMS = [{ label: 'Fonte: tutte', value: NESSUN_FILTRO }, ...CANALI_ITEMS]
// Nel filtro le voci vanno al plurale: si sceglie un gruppo, non una singola persona
export const RUOLI_DOPOSCUOLA_FILTRO_ITEMS = [
  { label: 'Chi è: tutti',       value: NESSUN_FILTRO },
  { label: 'Possibili studenti', value: 'STUDENTE' },
  { label: 'Possibili tutor',    value: 'TUTOR' },
]
export const ESITI_OPZIONALI_ITEMS = [{ label: 'Non indicato', value: NON_SPECIFICATO }, ...ESITI_ITEMS]
export const RUOLI_MARKETING_OPZIONALI_ITEMS = [{ label: 'Non specificato', value: NON_SPECIFICATO }, ...RUOLI_MARKETING_ITEMS]

// ─────────────────────────────────────────────
// COLORI DEI BADGE
// I colori stanno in shared/contatti.ts come testo: qui li riportiamo nel tipo
// che si aspettano i componenti Nuxt UI, così i template restano controllati.
// ─────────────────────────────────────────────

export type ColoreBadge = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

export const coloreStato = (v: string | null | undefined): ColoreBadge =>
  colorStato(v) as ColoreBadge

export const coloreEsito = (v: string | null | undefined): ColoreBadge =>
  colorEsito(v) as ColoreBadge

// ─────────────────────────────────────────────
// ICONE
// ─────────────────────────────────────────────

const ICONE_INTERAZIONE: Record<string, string> = {
  CHIAMATA:  'i-heroicons-phone',
  MESSAGGIO: 'i-heroicons-chat-bubble-left-ellipsis',
  EMAIL:     'i-heroicons-envelope',
  INCONTRO:  'i-heroicons-users',
  ALTRO:     'i-heroicons-ellipsis-horizontal-circle',
}

export const iconaInterazione = (tipo: string | null | undefined): string =>
  ICONE_INTERAZIONE[tipo ?? ''] ?? ICONE_INTERAZIONE.ALTRO!

// ─────────────────────────────────────────────
// DATE — sempre stringhe 'AAAA-MM-GG', mai oggetti Date
// (con le date-giorno il fuso orario sposta il risultato di un giorno)
// ─────────────────────────────────────────────

/** '2026-09-03' → '03/09/2026'. Nessuna conversione di fuso: solo tre pezzi di testo. */
export function formatGiorno(giorno: string | null | undefined): string {
  if (!giorno) return '—'
  const [anno, mese, gg] = giorno.split('-')
  if (!anno || !mese || !gg) return giorno
  return `${gg}/${mese}/${anno}`
}

/** Data e ora di un momento preciso (ultimo contatto, riga di diario). */
export function formatQuando(momento: string | null | undefined): string {
  if (!momento) return '—'
  const d = new Date(momento)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Giorno civile a N giorni da oggi (o da un altro giorno), sempre come 'AAAA-MM-GG'. */
export function giornoPiu(giorni: number, da: string = oggiISO()): string {
  const [anno, mese, giorno] = da.split('-').map(Number)
  if (!anno || !mese || !giorno) return da
  // Calcolo in UTC: sposta i giorni senza che l'ora legale cambi il risultato
  const d = new Date(Date.UTC(anno, mese - 1, giorno))
  d.setUTCDate(d.getUTCDate() + giorni)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const gg = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mm}-${gg}`
}

/** Momento attuale nel formato del campo "data e ora" del browser ('AAAA-MM-GGTHH:MM'). */
export function adessoPerInput(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Da 'AAAA-MM-GGTHH:MM' (ora locale) a ISO con fuso, come lo vuole lo sportello. */
export function inputInIso(valore: string): string | null {
  if (!valore) return null
  const d = new Date(valore)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

// ─────────────────────────────────────────────
// REGOLE DI LETTURA
// ─────────────────────────────────────────────

/** Il post-it "richiamare" è scaduto (o è di oggi) e il contatto non è ancora chiuso. */
export function ricontattoScaduto(
  contatto: Pick<Contatto, 'prossimoRicontatto' | 'stato'> | null | undefined,
  oggi: string = oggiISO(),
): boolean {
  if (!contatto?.prossimoRicontatto) return false
  if (STATI_CHIUSI.includes(contatto.stato)) return false
  return contatto.prossimoRicontatto <= oggi
}

/** "Rossi Maria" (cognome davanti, come nel resto del gestionale). */
export const nomeContatto = (c: Pick<Contatto, 'nome' | 'cognome'> | null | undefined): string =>
  c ? [c.cognome, c.nome].filter(Boolean).join(' ') : '—'

/** Riga piccola sotto il nome: cambia a seconda della tab. */
export function sottotitoloContatto(c: Contatto): string {
  // Un candidato tutor non ha uno studente né una classe: contano le materie che insegna
  const pezzi = c.tipo === 'DOPOSCUOLA'
    ? (c.doposcuolaRuolo === 'TUTOR'
        ? ['Candidato tutor', c.materie]
        : [c.nomeStudente, c.classeScuola, c.materie])
    : [c.azienda, c.marketingRuolo === 'CLIENTE' ? 'Cliente' : c.marketingRuolo === 'PARTNER' ? 'Partner' : null]
  return pezzi.filter(Boolean).join(' · ')
}

// ─────────────────────────────────────────────
// COLLEGAMENTI RAPIDI (telefono, WhatsApp, email)
// ─────────────────────────────────────────────

export const linkTelefono = (tel: string | null | undefined): string =>
  `tel:${normalizzaTelefono(tel ?? '')}`

export const linkWhatsapp = (tel: string | null | undefined): string =>
  `https://wa.me/${normalizzaTelefono(tel ?? '').replace('+', '')}`

export const linkEmail = (email: string | null | undefined): string => `mailto:${email ?? ''}`

/**
 * Indirizzo da aprire per il profilo/chat social.
 * Un link scritto per esteso si usa così com'è; un @nomeutente diventa un
 * indirizzo solo se sappiamo di quale social si tratta (la fonte del contatto).
 * Se non si può capire, restituisce null: resta un testo da leggere.
 */
export function linkSocial(
  valore: string | null | undefined,
  canale?: CanaleContatto | null,
): string | null {
  const v = (valore ?? '').trim()
  if (!v) return null

  if (v.startsWith('http')) return v

  if (v.startsWith('@')) {
    const nome = v.slice(1)
    if (!nome) return null
    if (canale === 'INSTAGRAM') return `https://instagram.com/${nome}`
    if (canale === 'TIKTOK')    return `https://tiktok.com/@${nome}`
    if (canale === 'FACEBOOK')  return `https://facebook.com/${nome}`
    return null
  }

  // Scritto senza "https://" davanti (es. "instagram.com/mariarossi")
  if (v.includes('.')) return `https://${v}`

  return null
}

/** Testo corto da mostrare in lista: senza "https://" e al massimo 32 caratteri. */
export function etichettaSocial(valore: string | null | undefined): string {
  const v = (valore ?? '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  if (!v) return ''
  return v.length > 32 ? `${v.slice(0, 31)}…` : v
}
