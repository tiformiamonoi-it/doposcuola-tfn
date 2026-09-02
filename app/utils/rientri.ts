// Sezione Rientri — solo ciò che serve all'interfaccia.
// Etichette, colori e regole dell'anno scolastico stanno in shared/rientri.ts
// (unica fonte, condivisa col server): qui le trasformiamo nel formato
// { label, value } che vogliono i USelect e aggiungiamo la formattazione.

import { STATI_RIENTRO, colorStatoRientro } from '#shared/rientri'
import type { StatoRientro } from '#shared/rientri'
// La parola-segnaposto "nessun filtro" e il tipo dei colori sono già definiti
// per i Contatti: si riusano, così i due elenchi si comportano allo stesso modo.
import { NESSUN_FILTRO } from './contatti'
import type { ColoreBadge } from './contatti'

// ─────────────────────────────────────────────
// FORMA DEI DATI CHE ARRIVANO DALLO SPORTELLO
// (le date viaggiano come testo: il JSON non ha un tipo "data")
// ─────────────────────────────────────────────

export interface RigaRientro {
  studentId: string
  firstName: string
  lastName: string
  classe: string | null
  scuola: string | null
  parentName: string | null
  parentPhone: string | null
  studentPhone: string | null
  parentEmail: string | null
  stato: StatoRientro
  /** Giorno civile in cui ha risposto ('AAAA-MM-GG') */
  dataRisposta: string | null
  note: string | null
  aggiornatoDaNome: string | null
  /** Ultima lezione fatta ('AAAA-MM-GG'); null = non ha mai iniziato */
  ultimaLezione: string | null
  haPacchettoAttivo: boolean
  pacchettoNome: string | null
}

export interface KpiRientri {
  daSentire: number
  confermati: number
  inForse: number
  nonTornano: number
  /** Hanno detto sì ma non hanno ancora scelto il pacchetto */
  confermatiSenzaPacchetto: number
  /** Alunni attivi che non hanno MAI fatto una lezione (nascosti di default) */
  maiPartiti: number
  totaleAttivi: number
  /** Nuovi alunni arrivati dai Contatti da agosto in poi */
  nuoviDaContatti: number
  /** Persone ancora in trattativa nei Contatti (non ancora iscritte) */
  inTrattativa: number
}

export interface RispostaRientri {
  /** L'anno che si sta guardando (può essere uno storico) */
  anno: string
  /** L'anno scolastico in corso secondo le Impostazioni */
  annoCorrente: string
  inizio: string
  /** Gli anni consultabili nel menu dello storico, dal più recente */
  anni: string[]
  items: RigaRientro[]
  kpi: KpiRientri
}

export const KPI_RIENTRI_VUOTI: KpiRientri = {
  daSentire: 0, confermati: 0, inForse: 0, nonTornano: 0,
  confermatiSenzaPacchetto: 0, maiPartiti: 0, totaleAttivi: 0,
  nuoviDaContatti: 0, inTrattativa: 0,
}

// ─────────────────────────────────────────────
// LISTE PER I MENU A TENDINA
// ─────────────────────────────────────────────

export const STATI_RIENTRO_ITEMS = STATI_RIENTRO.map((s) => ({ label: s.label, value: s.value }))

export const STATI_RIENTRO_FILTRO_ITEMS = [
  { label: 'Stato: tutti', value: NESSUN_FILTRO },
  ...STATI_RIENTRO_ITEMS,
]

// I tre bottoni della riga: le risposte che si possono dare con un click
export const RISPOSTE_RAPIDE = STATI_RIENTRO.filter((s) => s.value !== 'DA_SENTIRE')

// ─────────────────────────────────────────────
// COLORI DEI BADGE
// ─────────────────────────────────────────────

export const coloreStatoRientro = (v: string | null | undefined): ColoreBadge =>
  colorStatoRientro(v) as ColoreBadge

// ─────────────────────────────────────────────
// DATE — sempre stringhe 'AAAA-MM-GG', mai oggetti Date
// (con le date-giorno il fuso orario sposta il risultato di un giorno)
// ─────────────────────────────────────────────

const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const MESI_ESTESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]
const GIORNI_SETTIMANA = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']

/** '2026-06-12' → 'giu 2026'. Per l'ultima lezione basta il mese. */
export function formatMeseAnno(giorno: string | null | undefined): string {
  if (!giorno) return ''
  const [anno, mese] = giorno.split('-')
  const nome = MESI_BREVI[Number(mese) - 1]
  if (!anno || !nome) return giorno
  return `${nome} ${anno}`
}

/** '2026-09-14' → 'lunedì 14 settembre'. Calcolo in UTC: nessuno sfasamento. */
export function formatGiornoEsteso(giorno: string | null | undefined): string {
  if (!giorno) return ''
  const [anno, mese, gg] = giorno.split('-').map(Number)
  if (!anno || !mese || !gg) return giorno
  const d = new Date(Date.UTC(anno, mese - 1, gg))
  const settimana = GIORNI_SETTIMANA[d.getUTCDay()] ?? ''
  const nomeMese = MESI_ESTESI[mese - 1] ?? ''
  return `${settimana} ${gg} ${nomeMese}`.trim()
}

// ─────────────────────────────────────────────
// REGOLE DI LETTURA
// ─────────────────────────────────────────────

/** "Rossi Luca" (cognome davanti, come nel resto del gestionale). */
export const nomeAlunno = (r: Pick<RigaRientro, 'firstName' | 'lastName'> | null | undefined): string =>
  r ? `${r.lastName} ${r.firstName}`.trim() : '—'

/** Riga piccola sotto il nome: classe e scuola, se ci sono. */
export const classeScuola = (r: Pick<RigaRientro, 'classe' | 'scuola'>): string =>
  [r.classe, r.scuola].filter(Boolean).join(' · ')

/**
 * Il numero da usare per chiamare o scrivere: prima quello del genitore,
 * altrimenti quello dello studente. Null se non ce n'è nessuno.
 */
export const telefonoUtile = (r: Pick<RigaRientro, 'parentPhone' | 'studentPhone'>): string | null =>
  r.parentPhone || r.studentPhone || null
