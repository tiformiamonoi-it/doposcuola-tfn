// ─────────────────────────────────────────────
// LA MARCA DA BOLLO (F1) — un'unica fonte per server e interfaccia
//
// La legge: ogni fattura di importo superiore a 77,47 € richiede una marca da bollo
// da 2 €. Nel Centro la paga il cliente, e quei 2 € NON entrano nel prezzo del
// pacchetto: il pacchetto da 250 € resta da 250 €, il bollo è una riga a parte.
//
// Il bollo non si compra dal tabaccaio: si assolve "in modo virtuale" e si versa
// più avanti, cumulativamente, con un F24. Per questo in contabilità nascono DUE
// righe gemelle: un'ENTRATA da 2 € (i soldi che la famiglia ti ha dato davvero,
// che stanno in cassa) e un DEBITO da 2 € (quello che devi allo Stato e non hai
// ancora versato). Il debito esce di scena quando registri il versamento F24.
// ─────────────────────────────────────────────

/** Sopra questa cifra (esclusa) la fattura richiede la marca da bollo. */
export const SOGLIA_BOLLO = 77.47

/** Valore della marca da bollo, a carico del cliente. */
export const IMPORTO_BOLLO = 2

/**
 * Serve il bollo per questo pagamento? Sì solo se la fattura è richiesta E
 * l'importo supera la soglia. Stessa identica risposta sul server (che crea le
 * righe) e nell'interfaccia (che decide se mostrare la spunta): il conto si
 * scrive qui una volta sola, così i due non possono mai dire cose diverse.
 */
export function serveBollo(importo: number | null | undefined, richiedeFattura: boolean): boolean {
  return richiedeFattura === true && Number(importo ?? 0) > SOGLIA_BOLLO
}

/** "77,47 €" e "2,00 €" scritti all'italiana, per i testi dell'interfaccia. */
export const SOGLIA_BOLLO_LABEL  = SOGLIA_BOLLO.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const IMPORTO_BOLLO_LABEL = IMPORTO_BOLLO.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
