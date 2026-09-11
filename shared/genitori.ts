// I GENITORI DI UNA SCHEDA, LETTI E SCRITTI IN UN MODO SOLO — per server e frontend.
//
// Sulla scheda dell'alunno i genitori sono DUE SERIE DI COLONNE (parent* e
// parent2*), non una tabella a parte: il perché è scritto in
// server/database/schema/students.ts. Qui c'è l'unico "traduttore" fra quelle
// colonne e un genitore come lo pensa una persona (nome, telefono, email…): la
// ricerca, i fratelli, il wizard e la scheda lo usano tutti, così non si scrivono
// ognuno la propria mappa e non possono sbagliare in modi diversi — per esempio
// mandare la data di nascita alla serie 1, che quella colonna non ce l'ha.
//
// Collegare lo stesso genitore a due fratelli (C5) è una FOTOCOPIA, non una scheda
// famiglia condivisa: vuol dire scrivere gli stessi valori nelle colonne dell'altra
// scheda. Nessuna tabella nuova, nessun punto del gestionale da riscrivere.

import { normalizzaTelefono } from './phone'

/** Il posto sulla scheda: 1 = primo genitore (intestatario delle fatture), 2 = secondo. */
export type Slot = 1 | 2

export const CAMPI_GENITORE = [
  'nome', 'relazione', 'telefono', 'email', 'cf', 'piva', 'indirizzo', 'citta', 'cap', 'dataNascita',
] as const
export type CampoGenitore = (typeof CAMPI_GENITORE)[number]

/** L'anagrafica di UN genitore. Campo vuoto = null, mai stringa vuota. */
export type DatiGenitore = Record<CampoGenitore, string | null>

// La mappa campo → colonna, per ciascuna delle due serie.
// La serie 1 NON ha la data di nascita: è la riga "storica" letta dalla
// fatturazione, e la colonna non è mai stata aggiunta. Il valore null qui è ciò
// che fa saltare quel campo in scrittura (vedi scriviSerie).
export const COLONNE_SERIE: Record<Slot, Record<CampoGenitore, string | null>> = {
  1: {
    nome: 'parentName', relazione: 'parentRelazione', telefono: 'parentPhone', email: 'parentEmail',
    cf: 'parentCF', piva: 'parentPIva', indirizzo: 'parentIndirizzo', citta: 'parentCitta', cap: 'parentCap',
    dataNascita: null,
  },
  2: {
    nome: 'parent2Name', relazione: 'parent2Relazione', telefono: 'parent2Phone', email: 'parent2Email',
    cf: 'parent2CF', piva: 'parent2PIva', indirizzo: 'parent2Indirizzo', citta: 'parent2Citta', cap: 'parent2Cap',
    dataNascita: 'parent2DataNascita',
  },
}

// Come si chiamano i campi nelle frasi per la segreteria ("aggiorna anche lì
// (telefono, indirizzo)"). Minuscole apposta: finiscono in mezzo a una frase.
export const ETICHETTE_CAMPO: Record<CampoGenitore, string> = {
  nome: 'nome', relazione: 'parentela', telefono: 'telefono', email: 'email',
  cf: 'codice fiscale', piva: 'partita IVA', indirizzo: 'indirizzo', citta: 'città', cap: 'CAP',
  dataNascita: 'data di nascita',
}

const pulito = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

/**
 * I dati del genitore che sta nel posto `slot` di una scheda.
 * Accetta qualsiasi oggetto con i nomi delle colonne (la riga del database, la
 * risposta di /api/students/:id, il modulo della Modifica): non serve altro.
 */
export function leggiSerie(scheda: Record<string, any> | null | undefined, slot: Slot): DatiGenitore {
  const colonne = COLONNE_SERIE[slot]
  const dati = {} as DatiGenitore
  for (const campo of CAMPI_GENITORE) {
    const colonna = colonne[campo]
    dati[campo] = colonna && scheda ? pulito(scheda[colonna]) : null
  }
  return dati
}

/**
 * Il contrario: dai dati di un genitore alle colonne della serie scelta, pronte
 * per PUT /api/students/:id. Campo vuoto = null (mai stringa vuota).
 * `campi` limita la scrittura ad alcuni campi: serve ad aggiornare il fratello
 * solo in ciò che è cambiato. La data di nascita va SOLO sulla serie 2: sulla
 * serie 1 la colonna non esiste e il campo si salta in silenzio.
 */
export function scriviSerie(
  dati: Partial<Record<CampoGenitore, string | null | undefined>>,
  slot: Slot,
  campi: readonly CampoGenitore[] = CAMPI_GENITORE,
): Record<string, string | null> {
  const colonne = COLONNE_SERIE[slot]
  const valori: Record<string, string | null> = {}
  for (const campo of campi) {
    const colonna = colonne[campo]
    if (colonna) valori[colonna] = pulito(dati[campo])
  }
  return valori
}

/** C'è scritto QUALCOSA in quel posto? (Anche solo la parentela: sostituirlo la cancellerebbe.) */
export function haDatiGenitore(d: DatiGenitore): boolean {
  return CAMPI_GENITORE.some((campo) => Boolean(d[campo]))
}

/**
 * È una persona che si può proporre? Serve almeno un dato che la identifichi:
 * una riga con la sola parentela ("Madre") o il solo CAP non è nessuno.
 */
export function genitoreRiconoscibile(d: DatiGenitore): boolean {
  return Boolean(d.nome || d.telefono || d.email || d.cf || d.piva)
}

/**
 * Il telefono nella forma usata per riconoscere una persona: +39 e le sole cifre,
 * come fanno già i Contatti (normalizzaTelefono). Sotto le 6 cifre non è un
 * numero (è un interno, un refuso…): non serve a riconoscere nessuno, e due
 * refusi uguali farebbero diventare "fratelli" due alunni per caso.
 */
export function telefonoConfrontabile(v?: string | null): string {
  const n = normalizzaTelefono(v ?? '')
  return n.length - 3 >= 6 ? n : ''
}

/** Il nome ridotto all'osso per il confronto: niente maiuscole, accenti né spazi doppi. */
export function nomeConfrontabile(v?: string | null): string {
  return (v ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * I "documenti" con cui si riconosce la stessa persona su due schede diverse, dal
 * più sicuro al meno sicuro: codice fiscale, email, telefono. Stringa vuota = non c'è.
 */
export function chiaviGenitore(d: Partial<DatiGenitore>) {
  return {
    cf:       (d.cf ?? '').trim().toUpperCase(),
    email:    (d.email ?? '').trim().toLowerCase(),
    telefono: telefonoConfrontabile(d.telefono),
    nome:     nomeConfrontabile(d.nome),
  }
}

/**
 * La parentela detta a voce, senza articolo: "mamma", "papà", "tutore legale".
 * Serve alle frasi "Maria Bianchi, mamma di Luca Rossi". Senza articolo apposta:
 * con il testo libero ("Zia", "Affidataria") indovinare "il" o "la" vorrebbe dire
 * sbagliare prima o poi.
 */
export function parolaParentela(relazione?: string | null): string {
  const r = (relazione ?? '').trim().toLowerCase()
  if (!r) return 'genitore'
  if (r === 'madre' || r === 'mamma') return 'mamma'
  if (r === 'padre' || r === 'papà' || r === 'papa') return 'papà'
  return r
}

// ─────────────────────────────────────────────
// LE RISPOSTE DELLE API (stessa forma per server e frontend)
// ─────────────────────────────────────────────

/** L'account del portale di un genitore: si COLLEGA (password invariata), non si ricrea. */
export interface AccountGenitore {
  userId: string
  email: string
}

/** Un alunno visto dal lato del genitore ("mamma di Luca Rossi (3ª Media)"). */
export interface FiglioDiGenitore {
  id: string
  nome: string
  classe: string | null
  /** false = ex alunno (una famiglia può tornare con un altro figlio) */
  attivo: boolean
}

/** L'altro genitore registrato sulla stessa scheda: "Copio anche Paolo Rossi (papà)?" */
export interface AltroGenitore extends DatiGenitore {
  account: AccountGenitore | null
}

/**
 * Una PERSONA trovata dalla ricerca, non una riga: la stessa mamma registrata su
 * due figli è una persona sola, con due figli.
 * `figli[0]` è sempre l'alunno dalla cui scheda vengono i dati (e l'altroGenitore).
 */
export interface PersonaGenitore extends DatiGenitore {
  /** Identificativo stabile della persona nei risultati (per le liste dell'interfaccia) */
  chiave: string
  figli: FiglioDiGenitore[]
  account: AccountGenitore | null
  altroGenitore: AltroGenitore | null
}

/** GET /api/admin/genitori/cerca */
export interface RisultatoCercaGenitori {
  persone: PersonaGenitore[]
  /** true = ce ne sono altri oltre a quelli mostrati: conviene scrivere di più */
  altri: boolean
}

/** GET /api/admin/students/:id/genitori — i genitori di un alunno, pronti da copiare */
export interface GenitoriDelFratello {
  fratello: FiglioDiGenitore
  primo: PersonaGenitore | null
  secondo: PersonaGenitore | null
}

/** Da cosa si è capito che due alunni hanno un genitore in comune */
export type MotivoLegame = 'account' | 'cf' | 'email' | 'telefono'

export interface LegameFratello {
  /** Il posto del genitore in comune su QUESTA scheda (null = non si sa: solo account, email diversa) */
  mioSlot: Slot | null
  /** Il posto dello stesso genitore sulla scheda del fratello */
  suoSlot: Slot | null
  motivo: MotivoLegame
}

/** GET /api/admin/students/:id/fratelli */
export interface Fratello extends FiglioDiGenitore {
  legami: LegameFratello[]
}
