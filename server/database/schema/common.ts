import { pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'

export const cuid = () => createId()

export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'SUPER_TUTOR', 'TUTOR', 'GENITORE', 'STUDENTE'])
export const tutorPaymentModeEnum = pgEnum('tutor_payment_mode', ['ORE', 'FORFAIT'])
export const noteVisibilitaEnum = pgEnum('note_visibilita', ['INTERNA', 'FAMIGLIA'])
export const packageTypeEnum = pgEnum('package_type', ['ORE', 'MENSILE', 'A_CONSUMO'])
export const packageStatusEnum = pgEnum('package_status', [
  'ATTIVO',
  'DA_RINNOVARE',
  'SCADUTO',
  'ESAURITO',
  'DA_PAGARE',
  'PAGATO',
  'CHIUSO',
  'SOSPESO',
])
export const lessonTypeEnum = pgEnum('lesson_type', ['SINGOLA', 'GRUPPO', 'MAXI'])
export const paymentTypeEnum = pgEnum('payment_type', ['ACCONTO', 'SALDO', 'RATA', 'INTEGRAZIONE'])
export const paymentMethodEnum = pgEnum('payment_method', ['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO'])
export const accountingTypeEnum = pgEnum('accounting_type', ['ENTRATA', 'USCITA', 'NOTA', 'CREDITO', 'DEBITO'])
export const bookingStatusEnum = pgEnum('booking_status', ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'])
export const tutorPaymentStatusEnum = pgEnum('tutor_payment_status', ['PAGATO', 'PARZIALE', 'PRO_BONO'])
export const reimbursementStatusEnum = pgEnum('reimbursement_status', ['DA_PAGARE', 'PARZIALE', 'PAGATO'])
export const contactRequestStatusEnum = pgEnum('contact_request_status', ['PENDING', 'READ', 'RESOLVED'])

// Link "scegli la tua password": perché è stato creato.
// PRIMO_ACCESSO = account appena creato dalla segreteria (validità lunga)
// RECUPERO      = "password dimenticata" chiesto dall'utente (validità breve)
export const passwordTokenScopoEnum = pgEnum('password_token_scopo', ['PRIMO_ACCESSO', 'RECUPERO'])

// Sezione Contatti (mini-CRM): liste fisse condivise anche da shared/contatti.ts
export const contactTipoEnum = pgEnum('contact_tipo', ['DOPOSCUOLA', 'MARKETING'])
export const contactCanaleEnum = pgEnum('contact_canale', [
  'INSTAGRAM',
  'FACEBOOK',
  'TIKTOK',
  'WHATSAPP',
  'TELEFONO',
  'SITO_WEB',
  'EMAIL',
  'PASSAPAROLA',
  'META_ADS',
  'GOOGLE_ADS',
  'ALTRO',
])
export const contactStatoEnum = pgEnum('contact_stato', ['NUOVO', 'DA_RICONTATTARE', 'IN_TRATTATIVA', 'CONVERTITO', 'PERSO'])
export const contactMarketingRuoloEnum = pgEnum('contact_marketing_ruolo', ['CLIENTE', 'PARTNER'])
export const contactDoposcuolaRuoloEnum = pgEnum('contact_doposcuola_ruolo', ['STUDENTE', 'TUTOR'])
export const interactionTipoEnum = pgEnum('interaction_tipo', ['CHIAMATA', 'MESSAGGIO', 'EMAIL', 'INCONTRO', 'ALTRO'])
export const interactionDirezioneEnum = pgEnum('interaction_direzione', ['RICEVUTA', 'EFFETTUATA'])
export const interactionEsitoEnum = pgEnum('interaction_esito', ['RISPOSTO', 'NESSUNA_RISPOSTA', 'DA_RICHIAMARE'])

// Sezione Rientri (conferme di inizio anno scolastico): lista fissa condivisa
// anche da shared/rientri.ts
export const confirmationStatusEnum = pgEnum('confirmation_status', ['DA_SENTIRE', 'CONFERMATO', 'IN_FORSE', 'NON_TORNA'])

// Centro notifiche (il campanellino): di che cosa parla l'avviso.
// CONSENSO   = consensi privacy da raccogliere o in scadenza
// COMPLEANNO = valore previsto ma OGGI NON USATO: i compleanni si ricavano al volo
//              da data_nascita e non si salvano (vedi notifiche.ts). Sta qui perché
//              togliere un valore da un enum Postgres è un'operazione distruttiva:
//              meglio prevederlo adesso che dover rifare l'enum domani.
// GENERICA   = avviso libero scritto dal gestionale
export const notificaTipoEnum = pgEnum('notifica_tipo', ['CONSENSO', 'COMPLEANNO', 'GENERICA'])

// Consensi privacy (tabella `consensi`): DI CHE COSA si parla.
// MINORE_14 = autorizzazione del genitore per l'alunno che non ha ancora 14 anni
//             (art. 2-quinquies D.Lgs 196/2003). Riguarda l'ALUNNO.
// IMMAGINI  = liberatoria foto e video, facoltativa. Riguarda l'ALUNNO.
// MARKETING = comunicazioni promozionali. Riguarda LA PERSONA, non il figlio: se
//             la mamma dice no alle promozioni vale per lei, non "per Luca sì e
//             per Giulia no". Per questo la riga porta userId e non studentId.
export const consensoTipoEnum = pgEnum('consenso_tipo', ['MINORE_14', 'IMMAGINI', 'MARKETING'])

// Da DOVE è arrivato il cambiamento: dal portale (l'ha fatto la famiglia) o dal
// gestionale (l'ha registrato la segreteria). Non è un dettaglio tecnico: solo i
// cambiamenti della famiglia accendono il campanellino, perché quelli della
// segreteria li sta facendo proprio chi il campanellino lo guarderebbe.
export const consensoOrigineEnum = pgEnum('consenso_origine', ['PORTALE', 'GESTIONALE'])

// Assenze segnalate (tabella `assenze`, voce G1): da dove è arrivata la segnalazione.
// PORTALE    = l'ha scritta la famiglia (o il ragazzo) dal portale
// GESTIONALE = l'ha registrata la segreteria, di solito dopo una telefonata
// Stessa distinzione dei consensi, e per la stessa ragione: chi legge deve poter
// capire se l'informazione arriva dalla famiglia o dal racconto di una chiamata.
// È un enum SUO e non quello dei consensi, anche se oggi i valori coincidono:
// due cose diverse che condividono un elenco finiscono sempre per litigare il
// giorno in cui una delle due ha bisogno di un valore in più.
export const assenzaOrigineEnum = pgEnum('assenza_origine', ['PORTALE', 'GESTIONALE'])
