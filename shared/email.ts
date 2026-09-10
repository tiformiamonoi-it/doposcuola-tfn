// Esito degli invii di posta — definizione condivisa (server + client).
//
// Vive qui e non dentro server/utils/email.ts perché lo stesso vocabolario serve
// da tutte e due le parti: il server decide il motivo, l'interfaccia sceglie la
// frase da mostrare alla segreteria. Scriverlo una volta sola evita che i due
// lati si allontanino in silenzio (aggiungere un motivo lato server e dimenticare
// il ramo corrispondente lato pagina).

/** Perché un'email non è partita. */
export type MotivoEmail =
  /** Chiave API o mittente non configurati: la posta è spenta, non guasta. */
  | 'NON_CONFIGURATO'
  /** Brevo ha risposto rifiutando: account bloccato, mittente non verificato, IP non autorizzato… */
  | 'RIFIUTATO'
  /** Il server non è proprio riuscito a raggiungere Brevo: timeout, DNS, rete. */
  | 'RETE'

/**
 * I campi che ogni risposta "ho provato a mandare un invito" riporta all'interfaccia.
 * Il link c'è SEMPRE (è il piano B da copiare su WhatsApp); motivo e dettaglio
 * compaiono solo quando l'email non è partita.
 */
export type EsitoInvitoEmail = {
  emailInviata: boolean
  motivoEmail?: MotivoEmail
  dettaglioEmail?: string
}
