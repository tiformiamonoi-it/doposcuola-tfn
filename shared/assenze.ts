// IL PREAVVISO DELL'ASSENZA — la regola delle 10 del mattino (decisione Q22).
//
// Sta in shared/ perché la stessa regola serve in due posti che non si parlano:
// il SERVER, che decide se scrivere l'assenza come "fuori tempo", e il PORTALE,
// che deve avvisare la famiglia PRIMA di premere il bottone ("è tardi, conviene
// telefonare"). Se il numero fosse scritto due volte, un giorno qualcuno ne
// cambierebbe uno solo: la famiglia leggerebbe una regola e il gestionale ne
// applicherebbe un'altra, e nessuno se ne accorgerebbe fino alla lite.
//
// Metafora: è l'orario di chiusura scritto sulla porta. Deve essere lo stesso
// numero sul cartello fuori e sull'orologio di chi sta dentro.

/**
 * Entro quest'ora (compresa) l'assenza del giorno stesso è "in tempo".
 * Alle 10:00 in punto siamo già fuori tempo: il compromesso del piano è che la
 * febbre si scopre la mattina, ma alle 10 il calendario della giornata è già
 * affidabile e i tutor sono organizzati.
 */
export const ORA_LIMITE_ASSENZA = 10

/** '10:00', da scrivere nei messaggi senza incollare il numero a mano */
export const ORA_LIMITE_ASSENZA_TESTO = `${ORA_LIMITE_ASSENZA}:00`

/**
 * L'assenza per `giorno` è arrivata FUORI TEMPO?
 *
 * Solo il giorno stesso può essere fuori tempo: per domani (e per dopodomani) si
 * è sempre in anticipo, a qualunque ora si scriva. I giorni già passati non
 * arrivano mai qui: vengono rifiutati prima, perché un'assenza di ieri non è un
 * avviso, è un racconto.
 *
 * Funzione pura (niente orologi dentro): l'ora e il giorno glieli passa chi
 * chiama, così il server può usare l'orologio italiano del server e la pagina
 * quello del telefono senza che la regola cambi.
 */
export function assenzaFuoriTempo(giorno: string, oggi: string, oraCorrente: number): boolean {
  if (giorno !== oggi) return false
  return oraCorrente >= ORA_LIMITE_ASSENZA
}
