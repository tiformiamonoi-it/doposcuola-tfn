// L'ETÀ, CONTATA COME LA CONTA L'ANAGRAFE: gli anni COMPIUTI.
//
// Perché un file a parte e non "anno di oggi meno anno di nascita": quella
// sottrazione è una stima, non un'età. Chi è nato a dicembre 2012, a settembre
// 2026 non ha 14 anni — ne ha ancora 13, e per la legge è un'altra persona:
// sotto i 14 anni serve l'autorizzazione del genitore (art. 2-quinquies
// D.Lgs 196/2003), da 14 in su decide il ragazzo. Sbagliare di un anno qui
// vuol dire chiedere un consenso a chi non serve, o non chiederlo a chi serve.
// (In notifiche.service.ts c'è ancora la versione approssimata: lì serve solo a
// scrivere "compie 14 anni" negli auguri di compleanno, dove il giorno è già
// quello giusto per costruzione.)
//
// NIENTE `new Date()` CON L'ORA DENTRO. Qui si lavora solo su giorni civili
// 'AAAA-MM-GG', la convenzione di tutto il progetto (vedi shared/giorno-civile.ts):
// con un orario di mezzo, chi è nato a mezzanotte compirebbe gli anni un giorno
// prima o un giorno dopo a seconda del fuso, e il 29 febbraio diventerebbe il 1°
// marzo per colpa di un'ora di differenza. Confrontando due stringhe non succede.

import { giornoCivileValido, oggiISO } from './giorno-civile'

/**
 * Anni compiuti alla data indicata (oggi, se non si dice altro).
 * `null` quando la data di nascita manca o non è una data vera: "non lo so"
 * deve restare distinguibile da "zero anni".
 */
export function anniCompiuti(dataNascita: string, oggi?: string): number | null {
  if (!dataNascita || !giornoCivileValido(dataNascita)) return null

  const giorno = oggi ?? oggiISO()
  if (!giornoCivileValido(giorno)) return null

  let anni = Number(giorno.slice(0, 4)) - Number(dataNascita.slice(0, 4))

  // Il compleanno di quest'anno è già passato? Il confronto è fra le stringhe
  // 'MM-GG': ordinate alfabeticamente sono già ordinate anche come date
  // ('03-07' < '11-02'), perché il mese e il giorno hanno sempre due cifre.
  if (giorno.slice(5) < dataNascita.slice(5)) anni -= 1

  // Data di nascita nel futuro (errore di battitura in anagrafica): meglio
  // rispondere "non lo so" che un numero negativo che nessun controllo si aspetta.
  return anni < 0 ? null : anni
}

/**
 * Ha meno di 14 anni compiuti?
 *
 * **`null` quando la data di nascita manca**: "non lo so" NON è "no".
 * È la decisione Q17 del piano — senza la data non si chiede niente e non si
 * blocca niente, ma chi legge deve sapere che la risposta non c'è, non
 * ritrovarsi un "no" inventato che gli fa saltare un'autorizzazione dovuta.
 *
 * Nota sul 29 febbraio: chi è nato il 29/02/2012, in un anno senza il 29
 * febbraio, qui compie 14 anni il 1° marzo (il 28 risulta ancora minore). È il
 * verso prudente: per un giorno in più lo trattiamo come minore, e la peggiore
 * conseguenza è un'autorizzazione chiesta un giorno prima del necessario.
 * (Per gli auguri di compleanno vale l'altra convenzione, il 28: vedi
 * notifiche.service.ts. Sono due domande diverse — "chi festeggia oggi?" e
 * "quanti anni ha compiuti?" — e va bene che abbiano risposte diverse.)
 */
export function eMinoreDi14(dataNascita: string | null | undefined, oggi?: string): boolean | null {
  if (!dataNascita) return null
  const anni = anniCompiuti(dataNascita, oggi)
  if (anni === null) return null
  return anni < 14
}
