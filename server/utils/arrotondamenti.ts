// ─────────────────────────────────────────────
// LA REGOLA DEGLI ARROTONDAMENTI (F3) — leggila prima di toccare un conto
//
// Gli importi a database sono `numeric(10,2)`: Postgres li conserva e li somma in
// modo ESATTO, e ce li restituisce come stringhe ('4320.10'). Il guaio nasce dopo,
// in JavaScript, dove i numeri con la virgola sono approssimati: 4320,10 − 4320,50
// non fa −0,40 tondo, fa −0,3999999999996. Se quel risultato viene poi risommato ad
// altri, l'errore si propaga e in fondo alla catena compaiono i centesimi impossibili.
//
// LA REGOLA, UNA SOLA: le differenze e le somme si fanno sui valori ESATTI e si
// arrotonda UNA VOLTA SOLA, alla fine, su ciò che si mostra. Mai arrotondare un
// numero che dovrà ancora essere sommato o sottratto.
//
// In pratica ci sono due strumenti, uno per ogni caso:
//   • il conto sta tutto dentro una query  → si fa fare a SQL
//     (es. SUM(CASE WHEN tipo='ENTRATA' THEN importo ELSE -importo END) per un saldo);
//   • i pezzi arrivano da query diverse    → si convertono in CENTESIMI INTERI con
//     inCentesimi(), si sommano fra numeri interi (che in JavaScript sono esatti) e
//     si torna agli euro con inEuro() solo alla fine.
//
// Cosa NON cambia: i numeri che la segreteria vede restano gli stessi. Cambia solo
// che spariscono le code tipo −0,00000000004 che prima si trascinavano nei totali.
// ─────────────────────────────────────────────

/**
 * Da importo esatto del database (stringa 'numeric', o numero già a 2 decimali)
 * a CENTESIMI INTERI. Gli interi in JavaScript non hanno il difetto della virgola:
 * sommarli e sottrarli è esatto fino a cifre enormi, ben oltre i 99.999.999,99 €
 * che la colonna può contenere.
 */
export function inCentesimi(valore: string | number | null | undefined): number {
  const n = typeof valore === 'number' ? valore : parseFloat(valore ?? '0')
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

/**
 * Da centesimi interi a euro con due decimali. È l'UNICO arrotondamento della
 * catena: si chiama solo su ciò che viene mostrato o restituito all'interfaccia.
 */
export function inEuro(centesimi: number): number {
  return Number((centesimi / 100).toFixed(2))
}
