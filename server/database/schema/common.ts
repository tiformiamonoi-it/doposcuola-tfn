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
export const interactionTipoEnum = pgEnum('interaction_tipo', ['CHIAMATA', 'MESSAGGIO', 'EMAIL', 'INCONTRO', 'ALTRO'])
export const interactionDirezioneEnum = pgEnum('interaction_direzione', ['RICEVUTA', 'EFFETTUATA'])
export const interactionEsitoEnum = pgEnum('interaction_esito', ['RISPOSTO', 'NESSUNA_RISPOSTA', 'DA_RICHIAMARE'])
