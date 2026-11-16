// ─────────────────────────────────────────────
// LA CARD STUDENTE — la regola, scritta una volta sola (decisa da Alessandro il 16/11/2026)
//
// Nessuno accende o spegne la card a mano: la si ricava dai pacchetti, ogni volta che
// serve. Portale, pagina del negozio e (dal blocco 3) avvisi ed email chiamano TUTTI
// questa funzione: se la regola cambia, cambia qui e basta.
//
// 1. Ogni pacchetto "tiene accesa" la card fino a un giorno:
//    - MENSILE: scadenza + 15 giorni, pagato o no.
//    - ORE / A_CONSUMO: solo se ha almeno un pagamento (anche un acconto). Finché ci
//      sono ore, fino a scadenza + 15; a ore finite, ultima lezione svolta + 15,
//      comunque mai oltre scadenza + 15.
//    Vince il pacchetto che arriva più lontano.
// 2. Il freno dei debiti: un pacchetto con ancora qualcosa da saldare frena la card
//    15 giorni dopo la SUA scadenza, anche se intanto è arrivato un pacchetto nuovo.
//    Conta il più vecchio. Saldato (stato CHIUSO) non ha residuo, quindi non frena.
// 3. La data sulla card è la più vicina tra le due.
//
// Il flag `packages.sospeso` qui NON conta, di proposito: la card segue solo pacchetti
// e pagamenti, come dice il regolamento (art. 2). Nessuna scelta a mano del Centro.
//
// Tutte le date sono GIORNI CIVILI 'AAAA-MM-GG' già convertiti in ora italiana da chi
// chiama: la funzione non sa niente di fusi orari e si confrontano stringhe.
// ─────────────────────────────────────────────
import { aggiungiGiorni } from './giorno-civile'
import { inCentesimi, restaDaPagare } from './arrotondamenti'
import type { TipoPacchetto } from './scadenza-pacchetto'

export const GIORNI_MARGINE_CARD = 15

export type MotivoCard = 'SCADUTO' | 'DA_SALDARE' | 'ORE_FINITE' | 'NESSUN_PAGAMENTO' | 'DISATTIVATA'

// DISATTIVATA A MANO dalla segreteria (regolamento, art. 5.2, deciso il 16/11/2026): solo
// per uno di questi due motivi, mai per un pagamento in ritardo (a quello pensa la regola).
export const MOTIVI_DISATTIVAZIONE_CARD = ['RICHIESTA_FAMIGLIA', 'USO_SCORRETTO'] as const
export type MotivoDisattivazioneCard = (typeof MOTIVI_DISATTIVAZIONE_CARD)[number]
export const ETICHETTE_DISATTIVAZIONE_CARD: Record<MotivoDisattivazioneCard, string> = {
  RICHIESTA_FAMIGLIA: 'la famiglia lo ha chiesto',
  USO_SCORRETTO:      'uso scorretto (usata da altri)',
}

export type PacchettoPerCard = {
  tipo: TipoPacchetto
  dataScadenza: string | null      // giorno civile
  oreResiduo: string               // numeric del database
  importoPagato: string
  importoResiduo: string
  ultimaLezione: string | null     // giorno civile dell'ultima lezione svolta con questo pacchetto
  proBono?: boolean                // pacchetto "Pro Bono", in qualunque stato
}

// PRO BONO (deciso da Alessandro il 16/11/2026): chi è seguito gratuitamente ha la card
// SEMPRE attiva, senza data, senza contare ore e pagamenti (il pacchetto costa 0, quindi
// la regola "almeno un pagamento" non la accenderebbe mai). Si riconosce dal nome del
// pacchetto o del suo pacchetto standard, "Pro Bono", anche se chiuso: resta accesa anche
// d'estate, dopo la scadenza del 15/06. Si spegne SOLO archiviando l'alunno.
export const eNomeProBono = (nome: string | null | undefined) => (nome ?? '').trim().toLowerCase() === 'pro bono'

export type StatoCard = {
  attiva: boolean
  // Ultimo giorno valido. null = nessuna data da scrivere (pacchetto a ore senza
  // scadenza ancora in corso, oppure nessun pacchetto che l'abbia mai accesa).
  validaFino: string | null
  // Perché è sospesa, o perché si sospenderà se è nei 15 giorni di margine
  // (serve all'avviso "la card scade il…" del blocco 3). null quando è tutto a posto.
  motivo: MotivoCard | null
  inMargine: boolean
}

// "Senza fine": un pacchetto a ore ancora in corso e senza scadenza. Come stringa sta
// dopo qualsiasi giorno vero, così min/max restano semplici confronti.
const SENZA_FINE = '9999-12-31'

// `archiviato`: alunno disattivato in anagrafica (non più iscritto). Card sempre spenta,
// qualunque pacchetto abbia ancora (deciso da Alessandro il 16/11/2026).
// `disattivata`: la segreteria l'ha spenta a mano (art. 5.2). Vince su tutto, Pro Bono
// compresi: si controlla subito dopo l'archiviazione.
export function calcolaStatoCard(pacchetti: PacchettoPerCard[], oggi: string, archiviato = false, disattivata = false): StatoCard {
  if (archiviato) return { attiva: false, validaFino: null, motivo: 'SCADUTO', inMargine: false }
  if (disattivata) return { attiva: false, validaFino: null, motivo: 'DISATTIVATA', inMargine: false }
  if (pacchetti.some((p) => p.proBono)) return { attiva: true, validaFino: null, motivo: null, inMargine: false }

  // 1. Fino a quando i pacchetti la tengono accesa (il più lontano)
  let accesaFino: string | null = null
  let motivoAccesa: MotivoCard = 'SCADUTO'
  // Perché è spenta se nessun pacchetto la accende: solo pacchetti a ore mai pagati →
  // "nessun pagamento"; altrimenti "scaduto" (anche per chi non ha pacchetti: "rinnova").
  let motivoSpenta: MotivoCard = pacchetti.length > 0 ? 'NESSUN_PAGAMENTO' : 'SCADUTO'

  for (const p of pacchetti) {
    const tetto = p.dataScadenza ? aggiungiGiorni(p.dataScadenza, GIORNI_MARGINE_CARD) : SENZA_FINE
    let fino: string
    let motivo: MotivoCard = 'SCADUTO'

    if (p.tipo === 'MENSILE') {
      fino = tetto
    } else if (inCentesimi(p.importoPagato) <= 0) {
      continue   // a ore senza nemmeno un acconto: non accende niente
    } else if (parseFloat(p.oreResiduo) > 0) {
      fino = tetto
    } else if (!p.ultimaLezione) {
      // Ore finite senza lezioni registrate (es. tutte "perse"): non c'è un giorno da cui contare
      motivoSpenta = 'ORE_FINITE'
      continue
    } else {
      const dopoUltima = aggiungiGiorni(p.ultimaLezione, GIORNI_MARGINE_CARD)
      fino = dopoUltima < tetto ? dopoUltima : tetto
      if (dopoUltima < tetto) motivo = 'ORE_FINITE'
    }

    if (accesaFino === null || fino > accesaFino) {
      accesaFino = fino
      motivoAccesa = motivo
    }
  }

  // 2. Il freno dei debiti: il più vecchio pacchetto da saldare
  let frenoFino: string | null = null
  for (const p of pacchetti) {
    if (!p.dataScadenza || !restaDaPagare(p.importoResiduo)) continue
    const f = aggiungiGiorni(p.dataScadenza, GIORNI_MARGINE_CARD)
    if (frenoFino === null || f < frenoFino) frenoFino = f
  }

  // 3. La data più vicina tra le due
  if (accesaFino === null) {
    return { attiva: false, validaFino: null, motivo: motivoSpenta, inMargine: false }
  }
  const frena = frenoFino !== null && frenoFino <= accesaFino
  const fino = frena ? frenoFino! : accesaFino
  const motivo: MotivoCard = frena ? 'DA_SALDARE' : motivoAccesa
  const attiva = oggi <= fino

  if (fino === SENZA_FINE) return { attiva: true, validaFino: null, motivo: null, inMargine: false }

  // Ogni data della card è "qualcosa + 15 giorni": si è nel margine dal giorno dopo quel qualcosa
  const inMargine = attiva && oggi > aggiungiGiorni(fino, -GIORNI_MARGINE_CARD)
  return { attiva, validaFino: fino, motivo: attiva && !inMargine ? null : motivo, inMargine }
}

// LA CARD DEL GENITORE (deciso da Alessandro il 16/11/2026): ogni genitore registrato al
// portale ha la sua card, che segue quelle dei figli, ognuna già calcolata con la regola qui
// sopra (archiviati, disattivate a mano, Pro Bono e debiti compresi).
// - Attiva se almeno un figlio ha la card attiva, spenta quando nessuno ce l'ha.
// - "Valida fino al" è la data più lontana tra i figli attivi; se uno di loro ha la card
//   senza data (Pro Bono, pacchetto a ore senza scadenza), è senza data anche questa.
// Niente motivo: il perché sta sulla card di ciascun figlio. Niente "disattiva" a parte.
export function calcolaStatoCardGenitore(figli: StatoCard[]): { attiva: boolean; validaFino: string | null } {
  const attivi = figli.filter((f) => f.attiva)
  if (attivi.length === 0) return { attiva: false, validaFino: null }
  if (attivi.some((f) => f.validaFino === null)) return { attiva: true, validaFino: null }
  return { attiva: true, validaFino: attivi.map((f) => f.validaFino!).sort().at(-1)! }
}

// ─────────────────────────────────────────────
// IL CODICE DELLA CARD — es. K7QF-29XM
//
// Casuale e non in fila: con i numeri in fila chiunque proverebbe il successivo e
// vedrebbe il nome di un altro ragazzo. Alfabeto senza i caratteri che si confondono
// a voce o su uno schermo piccolo (0/O, 1/I/L). 31^8 ≈ 850 miliardi di combinazioni:
// insieme al limite di tentativi della pagina del negozio, provarli a caso è inutile.
// Lo stesso alfabeto è nelle migrazioni che hanno dato il codice agli alunni già in
// archivio (0039) e ai genitori già registrati (0041). Alunni e genitori pescano dallo
// stesso insieme: un codice non può mai essere di tutti e due (vedi codiceCardLibero).
// ─────────────────────────────────────────────
export const ALFABETO_CODICE_CARD = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generaCodiceCard(): string {
  const n = ALFABETO_CODICE_CARD.length
  let codice = ''
  while (codice.length < 8) {
    const [b] = crypto.getRandomValues(new Uint8Array(1))
    // Scartare i byte oltre l'ultimo multiplo di 31 evita che le prime lettere escano più spesso
    if (b! < 256 - (256 % n)) codice += ALFABETO_CODICE_CARD[b! % n]
  }
  return `${codice.slice(0, 4)}-${codice.slice(4)}`
}

// Il codice come lo scrive (o lo legge dal QR) chi controlla: maiuscole, trattino
// facoltativo. null se non può essere un codice: inutile disturbare il database.
export function normalizzaCodiceCard(input: string): string | null {
  const pulito = input.toUpperCase().replace(/[\s-]/g, '')
  if (pulito.length !== 8 || [...pulito].some((c) => !ALFABETO_CODICE_CARD.includes(c))) return null
  return `${pulito.slice(0, 4)}-${pulito.slice(4)}`
}
