/**
 * Riassume gli stati di un pacchetto per una visualizzazione leggera.
 *
 * Un pacchetto può avere più stati contemporaneamente (es. SCADUTO + PAGATO + CHIUSO),
 * ma mostrarli tutti è ridondante e visivamente pesante. Questa funzione riduce la lista
 * agli stati DAVVERO informativi, SENZA toccare la logica di calcolo (lavora solo
 * sull'array già calcolato da computePackageStates).
 *
 * Regola:
 *  1. CHIUSO → mostra solo 'CHIUSO' (stato finale: dice già tutto, niente badge ridondanti).
 *  2. Altrimenti → mostra TUTTI gli stati (ATTIVO sempre visibile quando c'è, e anche PAGATO),
 *     fino a 3 badge insieme (es. ATTIVO + DA_RINNOVARE + PAGATO).
 */
export function riassumiStati(stati: string[]): string[] {
  if (!stati || stati.length === 0) return []

  // 1. Stato finale: una sola etichetta.
  if (stati.includes('CHIUSO')) return ['CHIUSO']

  // 2. Tutti gli altri stati così come sono.
  return stati
}
