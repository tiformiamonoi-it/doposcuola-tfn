// Import di contatti da un file CSV preparato in Excel.
// Questo file contiene le regole di "traduzione" di UNA riga del file nei dati di
// un contatto, ed è usato in due momenti:
//  - nel browser, per mostrare l'anteprima e gli errori prima di inviare;
//  - sul server, per rivalidare tutto prima di scrivere nel database.
// Una sola fonte = anteprima e salvataggio non possono mai dire cose diverse.

import { normalizzaTelefono } from './phone'
import { giornoCivileValido } from './giorno-civile'
import {
  TIPI_CONTATTO,
  CANALI_CONTATTO,
  STATI_CONTATTO,
  RUOLI_MARKETING,
} from './contatti'
import type { TipoContatto } from './contatti'
import type { CreateContactInput } from './schemas/contact.schema'

/** Una riga del file, così com'è stata letta: solo testo, nessuna conversione. */
export interface RigaImportContatto {
  /** Numero della riga NEL FILE (l'intestazione è la riga 1): serve nei messaggi */
  riga?: number
  tipo?: string
  nome?: string
  cognome?: string
  telefono?: string
  email?: string
  /** Link al profilo o @nomeutente: vale come recapito */
  social?: string
  fonte?: string
  stato?: string
  prossimo_ricontatto?: string
  nome_studente?: string
  classe_scuola?: string
  materie?: string
  azienda?: string
  servizio_interesse?: string
  ruolo_marketing?: string
  note?: string
}

export type EsitoRigaImport =
  | { ok: true;  dati: CreateContactInput }
  | { ok: false; errori: string[] }

/** Le colonne del template, nell'ordine in cui compaiono nel file. */
export const COLONNE_IMPORT = [
  'tipo', 'nome', 'cognome', 'telefono', 'email', 'social', 'fonte', 'stato',
  'prossimo_ricontatto', 'nome_studente', 'classe_scuola', 'materie',
  'azienda', 'servizio_interesse', 'ruolo_marketing', 'note',
] as const

// ─────────────────────────────────────────────
// CONFRONTI "MORBIDI"
// L'utente scrive a mano in Excel: "Instagram", "INSTAGRAM", "Sito Web",
// "Da ricontattare" devono valere tutti. Si confrontano quindi le parole
// ridotte a una forma unica: maiuscole, senza accenti, con gli spazi come "_".
// ─────────────────────────────────────────────

function chiave(testo: string): string {
  return (testo ?? '')
    .normalize('NFD')
    // via gli accenti: 'è' scomposta diventa 'e' + segno, il segno si butta
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function trovaVoce<T extends string>(
  lista: ReadonlyArray<{ readonly value: T; readonly label: string }>,
  testo: string,
): T | null {
  const k = chiave(testo)
  if (!k) return null
  const trovata = lista.find((v) => chiave(v.value) === k || chiave(v.label) === k)
  return trovata ? trovata.value : null
}

/**
 * Data scritta come 'gg/mm/aaaa' (anche con - o .) oppure 'aaaa-mm-gg'
 * → sempre 'aaaa-mm-gg'. Vuoto = nessun promemoria.
 */
export function normalizzaGiornoImport(testo: string): { ok: true; valore: string | null } | { ok: false } {
  const t = (testo ?? '').trim()
  if (!t) return { ok: true, valore: null }

  const componi = (anno: string, mese: string, giorno: string) => {
    const valore = `${anno}-${mese.padStart(2, '0')}-${giorno.padStart(2, '0')}`
    // Non basta "mese 1–12, giorno 1–31": 31/04 o 30/02 sono refusi comuni nei CSV
    // e Postgres li rifiuterebbe al salvataggio, facendo saltare l'intero blocco.
    if (!giornoCivileValido(valore)) return { ok: false } as const
    return { ok: true, valore } as const
  }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (iso) return componi(iso[1]!, iso[2]!, iso[3]!)

  const italiana = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t)
  if (italiana) return componi(italiana[3]!, italiana[2]!, italiana[1]!)

  return { ok: false }
}

// ─────────────────────────────────────────────
// LA REGOLA PRINCIPALE: una riga del file → un contatto
// ─────────────────────────────────────────────

export function normalizzaRigaImport(
  riga: RigaImportContatto,
  tipoDefault: TipoContatto,
): EsitoRigaImport {
  const errori: string[] = []

  // Testo semplice: tolti gli spazi ai lati, vuoto = "campo non compilato"
  const testo = (etichetta: string, valore: string | undefined, max: number): string | null => {
    const v = (valore ?? '').trim()
    if (!v) return null
    if (v.length > max) {
      errori.push(`${etichetta}: troppo lungo (massimo ${max} caratteri)`)
      return null
    }
    return v
  }

  // Tipo (in quale cassetto va): vuoto = quello della scheda aperta
  let tipo: TipoContatto = tipoDefault
  const tipoScritto = (riga.tipo ?? '').trim()
  if (tipoScritto) {
    const trovato = trovaVoce(TIPI_CONTATTO, tipoScritto)
    if (!trovato) errori.push(`Tipo non riconosciuto: «${tipoScritto}» (scrivi Doposcuola o Marketing)`)
    else tipo = trovato
  }

  const nome = testo('Nome', riga.nome, 100)
  if (!nome) errori.push('Il nome è obbligatorio')

  // Telefono: sempre salvato come +39…, così "333 123 4567" e "3331234567"
  // sono la stessa persona e i doppioni si riconoscono
  let telefono: string | null = null
  const telefonoScritto = (riga.telefono ?? '').trim()
  if (telefonoScritto) {
    const normalizzato = normalizzaTelefono(telefonoScritto)
    if (!normalizzato || normalizzato.length > 20 || normalizzato.replace(/\D/g, '').length < 8) {
      errori.push(`Telefono non valido: «${telefonoScritto}»`)
    } else {
      telefono = normalizzato
    }
  }

  let email: string | null = null
  const emailScritta = (riga.email ?? '').trim()
  if (emailScritta) {
    const pulita = emailScritta.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(pulita) || pulita.length > 255) {
      errori.push(`Email non valida: «${emailScritta}»`)
    } else {
      email = pulita
    }
  }

  // Chi ci scrive solo in chat social non lascia né telefono né email: basta il profilo
  const socialLink = testo('Profilo social', riga.social, 300)

  if (!telefono && !email && !socialLink) {
    errori.push('Serve almeno un recapito: telefono, email o profilo social')
  }

  // Fonte (da dove ci ha conosciuto): vuoto = "Altro"
  let canaleOrigine: CreateContactInput['canaleOrigine'] = 'ALTRO'
  const fonteScritta = (riga.fonte ?? '').trim()
  if (fonteScritta) {
    const trovata = trovaVoce(CANALI_CONTATTO, fonteScritta)
    if (!trovata) errori.push(`Fonte non riconosciuta: «${fonteScritta}»`)
    else canaleOrigine = trovata
  }

  // Stato: vuoto = "Nuovo"
  let stato: CreateContactInput['stato'] = 'NUOVO'
  const statoScritto = (riga.stato ?? '').trim()
  if (statoScritto) {
    const trovato = trovaVoce(STATI_CONTATTO, statoScritto)
    if (!trovato) errori.push(`Stato non riconosciuto: «${statoScritto}»`)
    else stato = trovato
  }

  // Ruolo (solo Marketing): vuoto = non specificato
  let marketingRuolo: CreateContactInput['marketingRuolo'] = null
  const ruoloScritto = (riga.ruolo_marketing ?? '').trim()
  if (ruoloScritto) {
    const trovato = trovaVoce(RUOLI_MARKETING, ruoloScritto)
    if (!trovato) errori.push(`Ruolo non riconosciuto: «${ruoloScritto}» (scrivi Cliente o Partner)`)
    else marketingRuolo = trovato
  }

  // Promemoria "richiamare il…"
  let prossimoRicontatto: string | null = null
  const dataScritta = (riga.prossimo_ricontatto ?? '').trim()
  const giorno = normalizzaGiornoImport(dataScritta)
  if (!giorno.ok) errori.push(`Data del prossimo ricontatto non valida: «${dataScritta}» (usa gg/mm/aaaa)`)
  else prossimoRicontatto = giorno.valore

  const cognome           = testo('Cognome', riga.cognome, 100)
  const nomeStudente      = testo('Nome studente', riga.nome_studente, 200)
  const classeScuola      = testo('Classe/Scuola', riga.classe_scuola, 200)
  const materie           = testo('Materie', riga.materie, 500)
  const azienda           = testo('Attività/Azienda', riga.azienda, 200)
  const servizioInteresse = testo('Servizio di interesse', riga.servizio_interesse, 200)
  const note              = testo('Note', riga.note, 2000)

  if (errori.length > 0) return { ok: false, errori }

  return {
    ok: true,
    dati: {
      tipo,
      nome: nome as string,
      cognome,
      telefono,
      email,
      socialLink,
      canaleOrigine,
      stato,
      prossimoRicontatto,
      note,
      nomeStudente,
      classeScuola,
      materie,
      azienda,
      servizioInteresse,
      marketingRuolo,
      // Chi importa una lista non ha (ancora) comunicato l'informativa privacy:
      // la spunta si mette a mano, contatto per contatto.
      privacyInformata: false,
    },
  }
}
