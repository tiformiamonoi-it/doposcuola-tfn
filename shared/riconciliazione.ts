/**
 * Saldi reali verificati dall'utente l'11/07/2026 (conteggio fisico cassa + estratto conto).
 * Sono l'obiettivo finale della riconciliazione post-import: la pagina Riconciliazione
 * li usa come valori di partenza (modificabili) e l'import li stampa nel report.
 */
export const SALDI_OBIETTIVO = {
  contanti: 1371.53,
  banca: 8195.47,
} as const

/** Data del checkpoint: saldi verificati fisicamente all'import di giugno (14/06/2026 sera). */
export const CHECKPOINT_RICONCILIAZIONE = '2026-06-15'
