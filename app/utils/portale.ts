// PICCOLI AIUTI DEL PORTALE FAMIGLIE (grafica v6).
// Date e orari si ragionano sempre in ORA ITALIANA e in GIORNI CIVILI 'AAAA-MM-GG':
// il telefono può avere un fuso diverso, il Centro no.

/** Il giorno civile e i minuti dalla mezzanotte, adesso, in Italia */
export function adessoItalia(): { giorno: string; minuti: number } {
  const parti = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const p = (t: string) => parti.find((x) => x.type === t)?.value ?? '0'
  return { giorno: `${p('year')}-${p('month')}-${p('day')}`, minuti: Number(p('hour')) * 60 + Number(p('minute')) }
}

/** Il saluto della Home, che cambia con l'ora italiana (deciso il 16/11/2026) */
export function salutoDellOra(minuti = adessoItalia().minuti): string {
  if (minuti >= 5 * 60 && minuti < 13 * 60) return 'Buongiorno'
  if (minuti >= 13 * 60 && minuti < 18 * 60) return 'Buon pomeriggio'
  return 'Buonasera'
}

/**
 * 'AAAA-MM-GG' → "giovedì 19 novembre" (o con le opzioni che servono).
 * Letto a mezzogiorno UTC con fuso UTC: nessun fuso può spostare il giorno.
 */
export function giornoInParole(g: string, opzioni: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  return new Date(`${g}T12:00:00Z`).toLocaleDateString('it-IT', { timeZone: 'UTC', ...opzioni })
}

/** 'AAAA-MM-GG' → 'GG/MM/AAAA', senza passare da Date */
export const giornoNumeri = (g: string | null | undefined) => (g ? g.split('-').reverse().join('/') : '')

/**
 * La misura del nome sulla card: oltre 18 caratteri (spazi compresi) scende di un punto,
 * da 22 a 21 px (richiesta del 16/11/2026). A 390 px accanto alla tessera stanno circa
 * 18 caratteri a 22 px e 20 a 21 px: così i nomi da 19-20 restano su una riga.
 * Quelli più lunghi vanno a capo: lo spazio della tessera lo riserva la card (pr-16).
 */
export const classeNomeCard = (nome: string) => (nome.length > 18 ? 'text-[21px]' : 'text-[22px]')

/** Il giorno di una prenotazione del portale: la data UTC di requestedDate (si salva alle 12:00Z) */
export const giornoPrenotazione = (b: { requestedDate: string | Date }) => new Date(b.requestedDate).toISOString().slice(0, 10)

/**
 * L'orario limite di oggi è passato? Per un giorno futuro mai, per uno passato sempre.
 * Le stesse soglie del server: si prenota o modifica entro le 11:30, si annulla entro le 12:30.
 */
export function limitePassato(giorno: string, oraLimite: number, minutoLimite: number): boolean {
  const ora = adessoItalia()
  if (giorno !== ora.giorno) return giorno < ora.giorno
  return ora.minuti >= oraLimite * 60 + minutoLimite
}
export const lezioneModificabile = (giorno: string) => !limitePassato(giorno, 11, 30)
export const lezioneAnnullabile = (giorno: string) => !limitePassato(giorno, 12, 30)

export type TonoStato = 'verde' | 'rosso' | 'grigio' | 'blu' | 'crema'

/**
 * Lo stato del pacchetto come lo vede la famiglia: una parola sola. Mai ore o giorni
 * residui, e niente DA_PAGARE/PAGATO: restano in segreteria (privacy economica).
 */
export function statoPacchettoPortale(pkg: { stati?: string[] | null } | null | undefined): { etichetta: string; tono: TonoStato } {
  if (!pkg) return { etichetta: 'Nessun pacchetto', tono: 'grigio' }
  const stati = pkg.stati ?? []
  if (stati.includes('SOSPESO')) return { etichetta: 'Sospeso', tono: 'grigio' }
  if (stati.includes('SCADUTO')) return { etichetta: 'Scaduto', tono: 'rosso' }
  if (stati.includes('ESAURITO')) return { etichetta: 'Esaurito', tono: 'rosso' }
  return { etichetta: 'Attivo', tono: 'verde' }
}

/**
 * Lo stato di una lezione. Le prenotazioni nascono già confermate: un vecchio PENDING
 * rimasto nel database si mostra "Confermata", mai "in attesa".
 */
export function statoLezione(status: string, giorno: string): { etichetta: string; tono: TonoStato } {
  if (status === 'CANCELLED') return { etichetta: 'Annullata', tono: 'grigio' }
  if (status === 'COMPLETED' || giorno < adessoItalia().giorno) return { etichetta: 'Svolta', tono: 'blu' }
  return { etichetta: 'Confermata', tono: 'verde' }
}

/** Il collegamento WhatsApp della segreteria, con un messaggio già scritto */
export function whatsappSegreteria(numero: string, testo = 'Ciao, scrivo dal portale tiformiamonoi.it.'): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(testo)}`
}

// ─── La card studente spiegata alla famiglia (Home e pagina Card) ───
// `motivo` arriva solo al genitore: all'alunno il server non lo manda (privacy economica),
// e allora resta il messaggio generico "chiedi in segreteria".
export const TESTO_CARD_DISATTIVATA = 'Card disattivata dalla segreteria. Contattaci per sapere come riattivarla.'

export function testoCardSospesa(motivo: string | null | undefined, perGenitore: boolean): string {
  if (!perGenitore) return 'Chiedi in segreteria come riattivarla.'
  switch (motivo) {
    case 'DISATTIVATA':      return TESTO_CARD_DISATTIVATA
    case 'DA_SALDARE':       return 'C\'è un pacchetto da saldare. Quando la segreteria registra il pagamento, la card torna attiva da sola.'
    case 'ORE_FINITE':       return 'Le ore del pacchetto sono finite. Rinnova il pacchetto e la card torna attiva da sola.'
    case 'NESSUN_PAGAMENTO': return 'La card si attiva con il primo pagamento del pacchetto, anche solo un acconto.'
    default:                 return 'Il pacchetto è scaduto. Rinnovalo e la card torna attiva da sola.'
  }
}

export function testoCardInScadenza(motivo: string | null | undefined, perGenitore: boolean): string {
  if (!perGenitore) return 'Chiedi in segreteria per non perderla.'
  return motivo === 'DA_SALDARE'
    ? 'C\'è un pacchetto da saldare: salda entro questa data per continuare ad avere gli sconti.'
    : 'Rinnova il pacchetto entro questa data per continuare ad avere gli sconti.'
}
