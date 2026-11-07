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
// "OGNI CENTESIMO CONTA" (decisione del titolare): i confronti fra importi si fanno
// SOLO con le funzioni qui sotto, sui centesimi, in modo esatto. Nessuna tolleranza:
// 99,99 € pagati su 100 lasciano 0,01 € da pagare; 0,01 € da dare a un tutor è un debito.
//
// Vive in shared/ perché la stessa regola serve al server E al browser.
// ─────────────────────────────────────────────

type Importo = string | number | null | undefined

/**
 * Da importo (stringa 'numeric' del database o numero anche "sporco", es. 0.1+0.2)
 * a CENTESIMI INTERI. Gli interi in JavaScript non hanno il difetto della virgola:
 * sommarli e sottrarli è esatto fino a cifre enormi, ben oltre i 99.999.999,99 €
 * che la colonna può contenere.
 */
export function inCentesimi(valore: Importo): number {
  const n = typeof valore === 'number' ? valore : parseFloat(valore ?? '0')
  if (!Number.isFinite(n)) return 0
  // La virgola si sposta sul testo ('20.505e2' = 2050,5) e non con ×100
  // (20,505 × 100 = 2050,4999…): così il mezzo centesimo va lontano dallo zero,
  // come fa Postgres quando salva in numeric(10,2).
  const testo = String(Math.abs(n))
  const cent  = testo.includes('e') ? Math.abs(n) * 100 : Number(`${testo}e2`)
  return Math.sign(n) * Math.round(cent) || 0   // `|| 0`: niente −0
}

/**
 * Da centesimi interi a euro con due decimali. È l'UNICO arrotondamento della
 * catena: si chiama solo su ciò che viene mostrato o restituito all'interfaccia.
 */
export function inEuro(centesimi: number): number {
  return Number((centesimi / 100).toFixed(2))
}

/** Un importo arrotondato al centesimo (0.1 + 0.2 → 0.3). */
export function arrotonda(valore: Importo): number {
  return inEuro(inCentesimi(valore))
}

/** Resta almeno un centesimo da pagare (o da dare)? 0,01 € conta. */
export function restaDaPagare(residuo: Importo): boolean {
  return inCentesimi(residuo) > 0
}

/** L'importo copre il dovuto, centesimo per centesimo? 99,99 su 100 non copre. */
export function copre(importo: Importo, dovuto: Importo): boolean {
  return inCentesimi(importo) >= inCentesimi(dovuto)
}
