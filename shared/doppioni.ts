// I POSSIBILI DOPPIONI DI UN ALUNNO — il linguaggio comune fra server e browser (D3).
//
// Il problema che risolve: dalla scheda di un contatto si preme "Crea studente" e
// l'alunno nasce, senza che nessuno guardi se quel ragazzo è GIÀ in archivio. La
// mamma che aveva scritto a giugno, riconvertita a settembre, faceva nascere una
// seconda scheda identica: da lì in poi le lezioni finivano su una e i pagamenti
// sull'altra, e per accorgersene bisognava inciamparci.
//
// Qui dentro non c'è nessuna ricerca: ci sono solo i NOMI delle cose (che cosa
// vuol dire "somiglia") e le frasi con cui si spiega alla segreteria perché quel
// nome è comparso. La ricerca vera sta in server/services/doppioni.service.ts e
// riusa le normalizzazioni già scritte in shared/genitori.ts e shared/phone.ts:
// un criterio solo, non tre scritti in tre posti diversi che col tempo divergono.
//
// Nessuna di queste somiglianze BLOCCA la creazione (è la decisione Q21 del
// 14/09/2026): due fratelli con nomi simili e due omonimi veri sono casi
// legittimi. Si avvisa, si propone di collegare, e si lascia decidere a chi sa.

import { parolaParentela } from './genitori'

/** Da cosa si è capito che questo alunno somiglia a quello che si sta creando */
export type MotivoDoppione = 'nome' | 'telefono' | 'email'

/**
 * Il recapito che ha fatto scattare l'avviso, con il valore COME STA SCRITTO
 * sulla scheda trovata: serve alla segreteria per riconoscerlo a occhio
 * ("ah sì, è il numero della madre di Luca") invece di fidarsi di un elenco muto.
 */
export interface RecapitoCombaciato {
  tipo: 'telefono' | 'email'
  /** Di chi è quel recapito sulla scheda trovata */
  di: 'genitore' | 'alunno'
  /** Il nome dell'intestatario, se la scheda ce l'ha (es. "Maria Bianchi") */
  intestatario: string | null
  /** La parentela detta a voce: "mamma", "papà", "tutore legale" (null se non scritta) */
  parentela: string | null
  valore: string
}

/** Un alunno già in archivio che somiglia a quello che si sta creando */
export interface AlunnoSimile {
  id: string
  /** Nome e cognome come stanno sulla sua scheda */
  nome: string
  classe: string | null
  /** false = ex alunno: va detto, perché una scheda disattivata non si vede negli elenchi */
  attivo: boolean
  motivi: MotivoDoppione[]
  recapiti: RecapitoCombaciato[]
}

/** GET /api/admin/students/possibili-doppioni */
export interface RisultatoDoppioni {
  alunni: AlunnoSimile[]
}

/**
 * Quanti sospetti si mostrano al massimo. Oltre una manciata la finestra non
 * aiuta più a decidere: diventa un elenco da leggere, e si preme "Crea comunque"
 * senza guardare.
 */
export const MAX_DOPPIONI = 8

/** L'email ridotta all'osso per il confronto: niente maiuscole né spazi ai lati. */
export function emailConfrontabile(v?: string | null): string {
  return (v ?? '').trim().toLowerCase()
}

/**
 * Quanto è convincente un sospetto, dal più al meno: nome + recapito (3), solo
 * recapito (2), solo nome (1). Serve a mettere in cima quelli che la segreteria
 * deve guardare per primi: un omonimo e basta, in una scuola, è quasi normale;
 * un omonimo con lo stesso numero di telefono quasi certamente è la stessa persona.
 */
export function punteggioDoppione(a: AlunnoSimile): 1 | 2 | 3 {
  const perNome     = a.motivi.includes('nome')
  const perRecapito = a.motivi.includes('telefono') || a.motivi.includes('email')
  if (perNome && perRecapito) return 3
  return perRecapito ? 2 : 1
}

/**
 * "Molto probabile" = stesso nome e cognome PIÙ un recapito uguale. È l'unico
 * caso in cui anche il server si mette di traverso (risponde 409 a POST
 * /api/students finché non arriva `confermaDoppione`): la finestra del browser si
 * può saltare — pagina riaperta, chiamata diretta — e un alunno nato due volte
 * costa molto più di una conferma in più.
 */
export function doppioneMoltoProbabile(a: AlunnoSimile): boolean {
  return punteggioDoppione(a) === 3
}

/**
 * La riga corta da mettere accanto al nome: "stesso nome e cognome, stesso
 * telefono del genitore". Niente articoli davanti alla parentela ("della mamma",
 * "del papà"): con il testo libero delle relazioni ("Zia", "Affidataria")
 * indovinare il genere vorrebbe dire sbagliare prima o poi — il nome preciso
 * dell'intestatario sta comunque nel dettaglio qui sotto.
 */
export function spiegazioneDoppione(a: AlunnoSimile): string {
  const pezzi: string[] = []
  if (a.motivi.includes('nome')) pezzi.push('stesso nome e cognome')
  for (const tipo of ['telefono', 'email'] as const) {
    if (!a.motivi.includes(tipo)) continue
    const di = a.recapiti.find((r) => r.tipo === tipo)?.di === 'alunno' ? "dell'alunno" : 'del genitore'
    pezzi.push(tipo === 'telefono' ? `stesso telefono ${di}` : `stessa email ${di}`)
  }
  return pezzi.join(', ')
}

/** Il dettaglio: "Telefono del genitore (Maria Bianchi, mamma): 333 1234567" */
export function dettaglioRecapito(r: RecapitoCombaciato): string {
  const persona = [r.intestatario, r.parentela].filter(Boolean).join(', ')
  const chi = r.di === 'alunno'
    ? "dell'alunno"
    : persona ? `del genitore (${persona})` : 'del genitore'
  return `${r.tipo === 'telefono' ? 'Telefono' : 'Email'} ${chi}: ${r.valore}`
}

/**
 * La parentela pronta da mostrare, o null se sulla scheda non c'è scritta.
 * `parolaParentela` da sola risponde "genitore" quando non sa: qui quel ripiego
 * non serve, perché la frase dice già "del genitore".
 */
export function parentelaSeScritta(relazione?: string | null): string | null {
  return relazione?.trim() ? parolaParentela(relazione) : null
}
