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
  /** Non è partita PER SCELTA: questo tipo di email è spento in Impostazioni → Email. */
  | 'DISATTIVATO'

/** La frase corta per ogni motivo: la usano il registro, il campanellino e le comunicazioni. */
export const TESTO_MOTIVO_EMAIL: Record<MotivoEmail, string> = {
  NON_CONFIGURATO: 'servizio di posta non configurato',
  RIFIUTATO:       'il servizio di posta ha rifiutato l\'invio',
  RETE:            'servizio di posta irraggiungibile',
  DISATTIVATO:     'invio email spento nelle Impostazioni',
}

// I TIPI DI EMAIL che il gestionale manda. sendEmail vuole sapere sempre di che
// tipo è l'email: serve a decidere se può partire (interruttori qui sotto) e a
// scriverla nel registro con un nome che la segreteria capisce.
export const ETICHETTA_TIPO_EMAIL = {
  INVITO_ACCESSO:      'Invito primo accesso',
  RECUPERO_PASSWORD:   'Recupero password',
  PROVA:               'Email di prova',
  COMUNICAZIONE:       'Comunicazione alle famiglie',
  COMUNICAZIONE_PROVA: 'Prova di comunicazione',
  RIEPILOGO_SERALE:    'Riepilogo serale',
  AVVISO_ORE:          'Avviso ore quasi finite',
  AVVISO_SCADENZA:     'Avviso pacchetto in scadenza',
} as const

export type TipoEmail = keyof typeof ETICHETTA_TIPO_EMAIL

/** Com'è andato un tentativo, come lo scrive il registro email_log. */
export type EsitoRegistroEmail = 'INVIATA' | 'NON_PARTITA' | 'DISATTIVATA'

// GLI INTERRUTTORI, in un posto solo (li leggono il server per decidere e la
// pagina Impostazioni per disegnare gli switch). Ognuno è una riga di
// system_configs; `seAssente` dice com'è l'interruttore finché nessuno ha mai
// salvato le Impostazioni.
//
// null = sempre acceso, non si spegne: senza inviti e recupero password qualcuno
// resterebbe chiuso fuori, e le prove le chiede l'admin per sé.
//
// Gli avvisi sui pacchetti nascono SPENTI (decisione del titolare): così non
// serve scrivere niente in produzione, si accendono salvando l'interruttore.
export const INTERRUTTORE_EMAIL_GENERALE = { chiave: 'email_attive', seAssente: true } as const

export const INTERRUTTORI_EMAIL: Record<TipoEmail, { chiave: string; seAssente: boolean } | null> = {
  INVITO_ACCESSO:      null,
  RECUPERO_PASSWORD:   null,
  PROVA:               null,
  COMUNICAZIONE_PROVA: null,
  COMUNICAZIONE:       { chiave: 'email_comunicazioni_attive', seAssente: true },
  // Chiave già esistente prima del registro: si riusa, così chi l'aveva spento resta spento
  RIEPILOGO_SERALE:    { chiave: 'riepilogo_serale_attivo', seAssente: true },
  AVVISO_ORE:          { chiave: 'email_avviso_ore_attive', seAssente: false },
  AVVISO_SCADENZA:     { chiave: 'email_avviso_scadenza_attive', seAssente: false },
}

/**
 * Legge il valore salvato di un interruttore. Acceso-di-base: spento solo da un
 * "false" scritto apposta. Spento-di-base: acceso solo da un "true" scritto apposta.
 * Un valore vuoto o strano vale sempre come la riga assente.
 */
export function interruttoreAcceso(valore: string | null | undefined, seAssente: boolean): boolean {
  const v = (valore ?? '').trim().toLowerCase()
  return seAssente ? v !== 'false' : v === 'true'
}

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
