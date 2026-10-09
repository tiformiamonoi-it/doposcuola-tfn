// IL REGISTRO DELLE NOVITÀ — il "foglio appeso in sala insegnanti" dopo ogni aggiornamento.
//
// Si scrive QUI, a mano, a ogni pubblicazione: una voce nuova IN CIMA all'elenco
// (la più recente è sempre la prima). Niente database e niente pagina di modifica:
// il testo esce insieme al codice che racconta, quindi non può mai annunciare una
// cosa che online non c'è ancora.
//
// - versione: la DATA dell'uscita, 'AAAA.MM.GG'. Seconda uscita nello stesso giorno:
//   'AAAA.MM.GG.2'. È anche il numero che Admin e Super Tutor vedono in fondo al menu.
// - tutor / segreteria: le voci in parole semplici. Una lista vuota = quel pubblico
//   non vede nessuna finestra per questa versione. Genitori e studenti non vedono mai niente.
// - Il grassetto si scrive **così** (solo quello: il testo non diventa mai HTML).

export type PubblicoNovita = 'tutor' | 'segreteria'

export interface VersioneNovita {
  versione: string
  data: string // giorno civile 'AAAA-MM-GG'
  tutor: string[]
  segreteria: string[]
}

export const CHANGELOG: VersioneNovita[] = [
  {
    versione: '2026.10.09',
    data: '2026-10-09',
    tutor: [
      '**Esci anche dal telefono**: tocca "Menu" in basso, oppure il bottone rosso in "Il mio profilo".',
      '**Nuova voce "Note"**: scegli un alunno e leggi cosa hanno annotato i colleghi e la segreteria.',
      '**Quando aggiungi un alunno a una lezione** vedi la sua **classe** (per esempio "3ª media"). Il pacchetto lo sceglie il gestionale.',
    ],
    segreteria: [
      '**Comunicazioni**: un avviso a tutte le famiglie con il portale, nel portale e per email. Si sceglie ogni volta "Informativa" o "Promozionale", e la promozionale va solo a chi ha dato il consenso. C\'è la prova a te stessa.',
      '**Tutor archiviati**: "Disattiva" ora si chiama "Archivia". L\'elenco mostra solo chi lavora, e gli archiviati si vedono con "Mostra archiviati".',
      '**Matching**: nomi interi nelle caselle; la colonna di sinistra è divisa per scuola (Superiori, Medie, …) e poi per Mensili / A ore, con "Da sistemare" per chi non ha classe o pacchetto.',
      '**Fisso mensile dei tutor**: il fisso di un mese diventa "da saldare" dal mese dopo. Chi viene archiviato o passa "a ore" smette di maturarlo dal mese in corso.',
      '**I tutor ora vedono** le note interne degli alunni (non quelle per la famiglia ancora da approvare) e, nelle lezioni, la classe al posto del pacchetto. Con due pacchetti attivi viene usato quello che scade prima.',
    ],
  },
]

/** La versione online adesso: quella scritta in fondo al menu. */
export const ultimaVersione = CHANGELOG[0]!.versione

/** Tutte le versioni conosciute: l'endpoint "vista" accetta solo queste. */
export const versioniNote = CHANGELOG.map(v => v.versione)

/** L'ultima uscita che ha qualcosa da dire a questo pubblico (o nessuna). */
export function ultimaNovitaPer(pubblico: PubblicoNovita): VersioneNovita | undefined {
  return CHANGELOG.find(v => v[pubblico].length > 0)
}

/**
 * Questa versione l'utente l'ha già vista? Vale anche se ne ha vista una PIÙ
 * RECENTE: l'ordine lo dà l'elenco (non il confronto fra stringhe, che sbaglierebbe
 * con '…09.10' contro '…09.2'). Mai vista o versione sconosciuta = da mostrare.
 */
export function novitaGiaVista(versione: string, vista: string | null | undefined): boolean {
  const iVista = vista ? versioniNote.indexOf(vista) : -1
  return iVista !== -1 && iVista <= versioniNote.indexOf(versione)
}
