/**
 * server/database/schema.ts
 * "La Dispensa" — Struttura completa del database con Drizzle ORM
 *
 * Ogni tabella corrisponde a un'entità del sistema tiformiamonoi.it
 * Estratto e adattato dall'analisi di .old/backend/prisma/schema.prisma
 */

import {
  pgTable,
  pgEnum,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { numeric } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

// ─────────────────────────────────────────────
// HELPER: genera ID univoci (cuid2, leggeri e sicuri)
// ─────────────────────────────────────────────
const cuid = () => createId()

// ─────────────────────────────────────────────
// ENUMERAZIONI (valori fissi accettati dal DB)
// ─────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'SUPER_TUTOR', 'TUTOR', 'GENITORE'])

export const tutorPaymentModeEnum = pgEnum('tutor_payment_mode', ['ORE', 'FORFAIT'])

export const noteVisibilitaEnum = pgEnum('note_visibilita', ['INTERNA', 'FAMIGLIA'])

export const packageTypeEnum = pgEnum('package_type', ['ORE', 'MENSILE', 'A_CONSUMO'])

// Stati che un pacchetto può avere (più stati contemporaneamente tramite array)
export const packageStatusEnum = pgEnum('package_status', [
  'ATTIVO',       // Ore > 0 e non scaduto — si possono fare lezioni
  'DA_RINNOVARE', // Sotto 20% ore OPPURE scadenza entro 3 giorni
  'SCADUTO',      // dataScadenza < oggi
  'ESAURITO',     // oreResiduo = 0
  'DA_PAGARE',    // importoResiduo > 0
  'PAGATO',       // importoResiduo = 0
  'CHIUSO',       // PAGATO + (SCADUTO o ESAURITO) — non modificabile
])

export const lessonTypeEnum = pgEnum('lesson_type', [
  'SINGOLA', // 1 studente → compenso € 5,00/ora
  'GRUPPO',  // 2–4 studenti → compenso € 8,00/ora
  'MAXI',    // 5+ studenti → compenso € 8,50/ora
])

export const paymentTypeEnum = pgEnum('payment_type', [
  'ACCONTO',
  'SALDO',
  'RATA',
  'INTEGRAZIONE',
])

export const paymentMethodEnum = pgEnum('payment_method', [
  'CONTANTI',
  'BONIFICO',
  'POS',
  'ASSEGNO',
  'ALTRO',
])

export const accountingTypeEnum = pgEnum('accounting_type', [
  'ENTRATA', // Pagamento pacchetto
  'USCITA',  // Compenso tutor, spese
  'NOTA',    // Movimento informativo, non incide sul saldo
])

export const bookingStatusEnum = pgEnum('booking_status', [
  'PENDING',    // In attesa di risposta admin
  'CONFIRMED',  // Confermata con tutor assegnato
  'CANCELLED',  // Annullata
  'COMPLETED',  // Convertita in studente attivo
])

export const tutorPaymentStatusEnum = pgEnum('tutor_payment_status', [
  'PAGATO',
  'PARZIALE',
  'PRO_BONO',
])

export const reimbursementStatusEnum = pgEnum('reimbursement_status', [
  'DA_PAGARE',
  'PARZIALE',
  'PAGATO',
])

// ─────────────────────────────────────────────
// TABELLA: users  (Admin, Tutor, Genitore)
// ─────────────────────────────────────────────
export const users = pgTable('users', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  email:     varchar('email', { length: 255 }).notNull().unique(),
  password:  text('password').notNull(),         // Hash bcrypt
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName:  varchar('last_name', { length: 100 }).notNull(),
  role:      userRoleEnum('role').notNull().default('TUTOR'),
  phone:     varchar('phone', { length: 20 }),
  active:    boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex('users_email_idx').on(t.email),
}))

// ─────────────────────────────────────────────
// TABELLA: tutor_profiles  (dati fiscali/contatto estesi del tutor)
// ─────────────────────────────────────────────
export const tutorProfiles = pgTable('tutor_profiles', {
  id:           text('id').primaryKey().$defaultFn(cuid),
  userId:       text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  indirizzo:    text('indirizzo'),
  citta:        varchar('citta', { length: 100 }),
  cap:          varchar('cap', { length: 10 }),
  codiceFiscale: varchar('codice_fiscale', { length: 20 }),
  partitaIva:   varchar('partita_iva', { length: 20 }),
  materie:      text('materie').array().notNull().default([]),
  noteInterne:  text('note_interne'),

  // Compenso: ORE (tariffa a ora) oppure FORFAIT (importo mensile fisso)
  modalitaPagamento: tutorPaymentModeEnum('modalita_pagamento').notNull().default('ORE'),
  importoForfait:    numeric('importo_forfait', { precision: 10, scale: 2 }),

  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
})

// ─────────────────────────────────────────────
// TABELLA: students  (gli alunni)
// ─────────────────────────────────────────────
export const students = pgTable('students', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName:  varchar('last_name', { length: 100 }).notNull(),

  // Info scolastiche
  classe: varchar('classe', { length: 50 }),
  scuola: varchar('scuola', { length: 100 }),

  // Contatti alunno
  studentPhone: varchar('student_phone', { length: 20 }),
  studentEmail: varchar('student_email', { length: 255 }),

  // Dati genitore (per fatturazione)
  parentName:      varchar('parent_name', { length: 200 }),
  parentEmail:     varchar('parent_email', { length: 255 }),
  parentPhone:     varchar('parent_phone', { length: 20 }),
  parentIndirizzo: text('parent_indirizzo'),
  parentCitta:     varchar('parent_citta', { length: 100 }),
  parentCap:       varchar('parent_cap', { length: 10 }),
  parentCF:        varchar('parent_cf', { length: 20 }),
  parentPIva:      varchar('parent_piva', { length: 20 }),

  active:          boolean('active').notNull().default(true),
  note:            text('note'),
  bisogniSpeciali: text('bisogni_speciali'),

  // Portale Famiglie: FK all'account GENITORE (uno-a-molti: un genitore → più fratelli)
  portalUserId:                text('portal_user_id').references(() => users.id, { onDelete: 'set null' }),
  abilitatoPrenotazioneOnline: boolean('abilitato_prenotazione_online').notNull().default(false),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  activeNameIdx:  index('students_active_name_idx').on(t.active, t.lastName, t.firstName),
  portalUserIdx:  index('students_portal_user_idx').on(t.portalUserId),
}))

// ─────────────────────────────────────────────
// TABELLA: student_referrals  (chi ha portato chi)
// ─────────────────────────────────────────────
export const studentReferrals = pgTable('student_referrals', {
  id:         text('id').primaryKey().$defaultFn(cuid),
  referredId: text('referred_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  referrerId: text('referrer_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uniquePair:  uniqueIndex('referral_unique_pair').on(t.referredId, t.referrerId),
  referredIdx: index('referral_referred_idx').on(t.referredId),
  referrerIdx: index('referral_referrer_idx').on(t.referrerId),
}))

// ─────────────────────────────────────────────
// TABELLA: standard_packages  (template pacchetti configurabili)
// ─────────────────────────────────────────────
export const standardPackages = pgTable('standard_packages', {
  id:          text('id').primaryKey().$defaultFn(cuid),
  nome:        varchar('nome', { length: 200 }).notNull(),
  descrizione: text('descrizione'),
  tipo:        packageTypeEnum('tipo').notNull().default('ORE'),
  categoria:   varchar('categoria', { length: 100 }).notNull(),

  oreIncluse:        numeric('ore_incluse', { precision: 10, scale: 2 }).notNull(),
  giorniInclusi:     integer('giorni_inclusi'),
  orarioGiornaliero: numeric('orario_giornaliero', { precision: 10, scale: 2 }),
  prezzoStandard:    numeric('prezzo_standard', { precision: 10, scale: 2 }).notNull(),

  // Tariffa oraria — usata SOLO per i template di tipo A_CONSUMO
  tariffaOraria:     numeric('tariffa_oraria', { precision: 10, scale: 2 }),

  active:    boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  categoriaTipoIdx: index('std_pkg_categoria_tipo_idx').on(t.categoria, t.tipo),
}))

// ─────────────────────────────────────────────
// TABELLA: packages  (pacchetti acquistati dagli studenti)
//
// ⚠️  REGOLE MACCHINA A STATI (cristallizzate da packageStates.js):
//   ATTIVO       = oreResiduo > 0 AND non scaduto
//   DA_RINNOVARE = ATTIVO AND (percentuale < 20% OR scadenza entro 3 gg)
//   ESAURITO     = oreResiduo = 0
//   SCADUTO      = dataScadenza < oggi
//   DA_PAGARE    = importoResiduo > 0
//   PAGATO       = importoResiduo = 0
//   CHIUSO       = PAGATO AND (SCADUTO OR ESAURITO)
// ─────────────────────────────────────────────
export const packages = pgTable('packages', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  standardPackageId: text('standard_package_id').references(() => standardPackages.id, { onDelete: 'set null' }),

  nome: varchar('nome', { length: 200 }).notNull(),
  tipo: packageTypeEnum('tipo').notNull().default('ORE'),

  // Quantità ore/giorni
  oreAcquistate:     numeric('ore_acquistate', { precision: 10, scale: 2 }).notNull(),
  oreResiduo:        numeric('ore_residuo', { precision: 10, scale: 2 }).notNull(),
  orePerse:          numeric('ore_perse', { precision: 10, scale: 2 }).notNull().default('0'),

  // Solo per pacchetti MENSILI
  giorniAcquistati:  integer('giorni_acquistati'),
  giorniResiduo:     integer('giorni_residuo'),
  orarioGiornaliero: numeric('orario_giornaliero', { precision: 10, scale: 2 }),

  // Tariffa oraria — usata SOLO per i pacchetti A_CONSUMO (copiata dal template, modificabile)
  tariffaOraria:     numeric('tariffa_oraria', { precision: 10, scale: 2 }),

  // Importi economici
  prezzoTotale:   numeric('prezzo_totale', { precision: 10, scale: 2 }).notNull(),
  importoPagato:  numeric('importo_pagato', { precision: 10, scale: 2 }).notNull().default('0'),
  importoResiduo: numeric('importo_residuo', { precision: 10, scale: 2 }).notNull(),

  // Validità
  dataInizio:   timestamp('data_inizio').notNull(),
  dataScadenza: timestamp('data_scadenza'),

  // Macchina a stati — array di stati coesistenti
  stati: packageStatusEnum('stati').array().notNull().default(['ATTIVO']),

  note:      text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  studentStatiIdx: index('pkg_student_stati_idx').on(t.studentId, t.stati),
  tipoCreatedIdx:  index('pkg_tipo_created_idx').on(t.tipo, t.createdAt),
}))

// ─────────────────────────────────────────────
// TABELLA: package_recharges  (il "libretto" delle ricariche dei pacchetti A_CONSUMO)
// Ogni riga = un rifornimento di ore con relativo costo.
// ─────────────────────────────────────────────
export const packageRecharges = pgTable('package_recharges', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  packageId: text('package_id').notNull().references(() => packages.id, { onDelete: 'cascade' }),

  ore:           numeric('ore', { precision: 10, scale: 2 }).notNull(),           // ore aggiunte
  tariffaOraria: numeric('tariffa_oraria', { precision: 10, scale: 2 }).notNull(), // snapshot tariffa
  importo:       numeric('importo', { precision: 10, scale: 2 }).notNull(),        // totale ricarica

  data:      timestamp('data').notNull().defaultNow(),
  paymentId: text('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  note:      text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  packageDataIdx: index('recharges_package_data_idx').on(t.packageId, t.data),
}))

// ─────────────────────────────────────────────
// TABELLA: payments  (pagamenti su un pacchetto)
// ─────────────────────────────────────────────
export const payments = pgTable('payments', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  packageId: text('package_id').notNull().references(() => packages.id, { onDelete: 'cascade' }),

  importo:         numeric('importo', { precision: 10, scale: 2 }).notNull(),
  tipoPagamento:   paymentTypeEnum('tipo_pagamento').notNull().default('ACCONTO'),
  metodoPagamento: paymentMethodEnum('metodo_pagamento').notNull().default('CONTANTI'),

  richiedeFattura: boolean('richiede_fattura').notNull().default(false),
  dataPagamento:   timestamp('data_pagamento').notNull().defaultNow(),
  riferimento:     text('riferimento'), // Numero ricevuta, codice bonifico, ecc.
  note:            text('note'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  pkgDateIdx: index('payments_pkg_date_idx').on(t.packageId, t.dataPagamento),
}))

// ─────────────────────────────────────────────
// TABELLA: time_slots  (slot orari configurabili)
// ─────────────────────────────────────────────
export const timeSlots = pgTable('time_slots', {
  id:          text('id').primaryKey().$defaultFn(cuid),
  oraInizio:   varchar('ora_inizio', { length: 5 }).notNull(),  // Es: "15:30"
  oraFine:     varchar('ora_fine', { length: 5 }).notNull(),    // Es: "16:30"
  descrizione: text('descrizione'),
  active:      boolean('active').notNull().default(true),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uniqueSlot: uniqueIndex('time_slots_unique').on(t.oraInizio, t.oraFine),
}))

// ─────────────────────────────────────────────
// TABELLA: lessons  (una lezione = 1 tutor + N studenti)
//
// TARIFFE TUTOR (da lessonCalculations.js):
//   SINGOLA  = € 5,00/ora  |  mezza ora: € 2,50
//   GRUPPO   = € 8,00/ora  |  mezza ora: € 4,00
//   MAXI     = € 8,50/ora  |  mezza ora: € 4,00
// ─────────────────────────────────────────────
export const lessons = pgTable('lessons', {
  id:         text('id').primaryKey().$defaultFn(cuid),
  tutorId:    text('tutor_id').notNull().references(() => users.id),
  timeSlotId: text('time_slot_id').notNull().references(() => timeSlots.id),
  data:       timestamp('data').notNull(),

  tipo:        lessonTypeEnum('tipo').notNull().default('SINGOLA'),
  mezzaLezione: boolean('mezza_lezione').notNull().default(false),
  forzaGruppo: boolean('forza_gruppo').notNull().default(false), // Paga tariffa GRUPPO anche con 1 studente

  // Compenso calcolato automaticamente al momento della creazione
  compensoTutor: numeric('compenso_tutor', { precision: 10, scale: 2 }),

  note:      text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  dataTutorIdx: index('lessons_data_tutor_idx').on(t.data, t.tutorId),
  tutorDataIdx: index('lessons_tutor_data_idx').on(t.tutorId, t.data),
}))

// ─────────────────────────────────────────────
// TABELLA: lesson_students  (tabella ponte: studenti in una lezione)
//
// REGOLA SCALAMENTO ORE:
//   - Sempre -1 ora dal pacchetto (anche per mezzaLezione a livello oreResiduo)
//   - Per pacchetti MENSILI: -1 giorno SOLO se è la prima lezione dello studente in quella data
// ─────────────────────────────────────────────
export const lessonStudents = pgTable('lesson_students', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  lessonId:  text('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  packageId: text('package_id').notNull().references(() => packages.id, { onDelete: 'cascade' }),

  oreScalate:   numeric('ore_scalate', { precision: 10, scale: 2 }).notNull().default('1.0'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uniqueLessonStudent: uniqueIndex('ls_unique').on(t.lessonId, t.studentId),
  studentIdx:          index('ls_student_idx').on(t.studentId),
  packageStudentIdx:   index('ls_package_student_idx').on(t.packageId, t.studentId),
}))

// ─────────────────────────────────────────────
// TABELLA: accounting_entries  (registro contabile)
// ─────────────────────────────────────────────
export const accountingEntries = pgTable('accounting_entries', {
  id:          text('id').primaryKey().$defaultFn(cuid),
  tipo:        accountingTypeEnum('tipo').notNull(),
  importo:     numeric('importo', { precision: 10, scale: 2 }).notNull(),
  descrizione: text('descrizione').notNull(),
  categoria:   varchar('categoria', { length: 100 }),
  data:        timestamp('data').notNull().defaultNow(),

  // Relazioni opzionali (movimento può essere collegato a uno di questi)
  packageId:      text('package_id').references(() => packages.id, { onDelete: 'set null' }),
  lessonId:       text('lesson_id').references(() => lessons.id, { onDelete: 'set null' }),
  paymentId:      text('payment_id').references(() => payments.id, { onDelete: 'set null' }).unique(),

  metodoPagamento: paymentMethodEnum('metodo_pagamento'),
  fatturaEmessa:   boolean('fattura_emessa').notNull().default(false),
  note:            text('note'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tipoDataIdx:    index('acc_tipo_data_idx').on(t.tipo, t.data),
  categoriaIdx:   index('acc_categoria_idx').on(t.categoria),
  metodoIdx:      index('acc_metodo_idx').on(t.metodoPagamento),
}))

// ─────────────────────────────────────────────
// TABELLA: tutor_payments  (compensi mensili ai tutor)
// ─────────────────────────────────────────────
export const tutorPayments = pgTable('tutor_payments', {
  id:      text('id').primaryKey().$defaultFn(cuid),
  tutorId: text('tutor_id').notNull().references(() => users.id),

  mese:    timestamp('mese').notNull(), // Salvato come primo del mese (es: 2025-11-01)
  importo: numeric('importo', { precision: 10, scale: 2 }).notNull(),

  dataPagamento: timestamp('data_pagamento').notNull().defaultNow(),
  metodo:        paymentMethodEnum('metodo').notNull().default('BONIFICO'),
  status:        tutorPaymentStatusEnum('status').notNull().default('PAGATO'),
  note:          text('note'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tutorMeseIdx: index('tutor_payments_tutor_mese_idx').on(t.tutorId, t.mese),
}))

// ─────────────────────────────────────────────
// TABELLA: tutor_reimbursements  (rimborsi spese tutor)
// ─────────────────────────────────────────────
export const tutorReimbursements = pgTable('tutor_reimbursements', {
  id:      text('id').primaryKey().$defaultFn(cuid),
  tutorId: text('tutor_id').notNull().references(() => users.id),

  importo:       numeric('importo', { precision: 10, scale: 2 }).notNull(),
  importoPagato: numeric('importo_pagato', { precision: 10, scale: 2 }).notNull().default('0'),
  descrizione:   text('descrizione').notNull(),

  dataRichiesta: timestamp('data_richiesta').notNull().defaultNow(),
  dataPagamento: timestamp('data_pagamento'),

  stato:  reimbursementStatusEnum('stato').notNull().default('DA_PAGARE'),
  metodo: paymentMethodEnum('metodo'),
  note:   text('note'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tutorStatoIdx: index('reimbursements_tutor_stato_idx').on(t.tutorId, t.stato),
}))

// ─────────────────────────────────────────────
// TABELLA: bookings  (prenotazioni da pagina pubblica — senza login)
// ─────────────────────────────────────────────
export const bookings = pgTable('bookings', {
  id:             text('id').primaryKey().$defaultFn(cuid),
  // Flusso anonimo eliminato — solo GENITORE autenticato può prenotare
  userId: text('user_id').notNull().references(() => users.id),
  studentId: text('student_id').references(() => students.id, { onDelete: 'set null' }),

  studentName:    varchar('student_name', { length: 100 }).notNull(),
  studentSurname: varchar('student_surname', { length: 100 }).notNull(),
  studentPhone:   varchar('student_phone', { length: 20 }).notNull(),

  requestedDate: timestamp('requested_date').notNull(),
  notes:         text('notes'),

  status: bookingStatusEnum('status').notNull().default('PENDING'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  statusDateIdx: index('bookings_status_date_idx').on(t.status, t.requestedDate),
  userIdx:       index('bookings_user_idx').on(t.userId),
  studentIdx:    index('bookings_student_idx').on(t.studentId),
}))

// ─────────────────────────────────────────────
// TABELLA: booking_subjects  (materie richieste + tutor assegnato)
// ─────────────────────────────────────────────
export const bookingSubjects = pgTable('booking_subjects', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  name:      varchar('name', { length: 100 }).notNull(),
  bookingId: text('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),

  assignedTutorId: text('assigned_tutor_id').references(() => users.id),
  assignedSlot:    varchar('assigned_slot', { length: 20 }), // Es: "15:30-16:30"
  assignedAt:      timestamp('assigned_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  bookingIdx:      index('booking_subjects_booking_idx').on(t.bookingId),
  assignedTutorIdx: index('booking_subjects_tutor_idx').on(t.assignedTutorId),
}))

// ─────────────────────────────────────────────
// TABELLA: tutor_availabilities  (giorni in cui il tutor è disponibile)
// ─────────────────────────────────────────────
export const tutorAvailabilities = pgTable('tutor_availabilities', {
  id:     text('id').primaryKey().$defaultFn(cuid),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date:   timestamp('date').notNull(),
  notes:  text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uniqueUserDate: uniqueIndex('availability_user_date_unique').on(t.userId, t.date),
  dateIdx:        index('availability_date_idx').on(t.date),
}))

// ─────────────────────────────────────────────
// TABELLA: closure_dates  (giorni di chiusura del centro)
// ─────────────────────────────────────────────
export const closureDates = pgTable('closure_dates', {
  id:          text('id').primaryKey().$defaultFn(cuid),
  date:        timestamp('date').notNull().unique(),
  description: text('description'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  dateIdx: index('closure_date_idx').on(t.date),
}))

// ─────────────────────────────────────────────
// TABELLA: student_notes  (note didattiche per studente)
//
// VISIBILITÀ:
//   INTERNA  = solo ADMIN, SUPER_TUTOR, TUTOR che la leggono nel gestionale
//   FAMIGLIA = visibile anche al GENITORE nel portale famiglie
//
// CANCELLAZIONE:
//   ADMIN e SUPER_TUTOR → cancellano qualsiasi nota
//   TUTOR → cancella solo le proprie note
// ─────────────────────────────────────────────
export const studentNotes = pgTable('student_notes', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  authorId:  text('author_id').notNull().references(() => users.id),

  contenuto:  text('contenuto').notNull(),
  visibilita: noteVisibilitaEnum('visibilita').notNull().default('INTERNA'),

  // Nota opzionalmente collegata a una lezione specifica
  lessonId: text('lesson_id').references(() => lessons.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  studentIdx:    index('notes_student_idx').on(t.studentId),
  authorIdx:     index('notes_author_idx').on(t.authorId),
  visibilitaIdx: index('notes_visibilita_idx').on(t.visibilita),
}))

// ─────────────────────────────────────────────
// TABELLA: system_configs  (impostazioni globali chiave-valore)
// ─────────────────────────────────────────────
export const systemConfigs = pgTable('system_configs', {
  id:          text('id').primaryKey().$defaultFn(cuid),
  key:         varchar('key', { length: 100 }).notNull().unique(),
  value:       text('value').notNull(),
  description: text('description'),
  category:    varchar('category', { length: 50 }), // Es: "tariffe", "generale"
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  categoryIdx: index('system_configs_category_idx').on(t.category),
}))

// ─────────────────────────────────────────────
// RELAZIONI (per query con join automatici)
// ─────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  tutorProfile:    one(tutorProfiles, { fields: [users.id], references: [tutorProfiles.userId] }),
  lessons:         many(lessons),
  tutorPayments:   many(tutorPayments),
  reimbursements:  many(tutorReimbursements),
  availabilities:  many(tutorAvailabilities),
  bookingSubjects: many(bookingSubjects),
  bookings:        many(bookings),
  // Studenti collegati al portale (un GENITORE → più fratelli)
  linkedStudents:  many(students, { relationName: 'portalUser' }),
  // Note didattiche scritte da questo utente
  authoredNotes:   many(studentNotes),
}))

export const tutorProfilesRelations = relations(tutorProfiles, ({ one }) => ({
  user: one(users, { fields: [tutorProfiles.userId], references: [users.id] }),
}))

export const studentsRelations = relations(students, ({ one, many }) => ({
  packages:   many(packages),
  referredBy: many(studentReferrals, { relationName: 'referred' }),
  referrals:  many(studentReferrals, { relationName: 'referrer' }),
  // Account portale del genitore collegato
  portalUser: one(users, { fields: [students.portalUserId], references: [users.id], relationName: 'portalUser' }),
  notes:      many(studentNotes),
}))

export const packagesRelations = relations(packages, ({ one, many }) => ({
  student:         one(students, { fields: [packages.studentId], references: [students.id] }),
  standardPackage: one(standardPackages, { fields: [packages.standardPackageId], references: [standardPackages.id] }),
  payments:        many(payments),
  lessonStudents:  many(lessonStudents),
  accountingEntries: many(accountingEntries),
  recharges:       many(packageRecharges),
}))

export const packageRechargesRelations = relations(packageRecharges, ({ one }) => ({
  package: one(packages, { fields: [packageRecharges.packageId], references: [packages.id] }),
  payment: one(payments, { fields: [packageRecharges.paymentId], references: [payments.id] }),
}))

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  tutor:          one(users, { fields: [lessons.tutorId], references: [users.id] }),
  timeSlot:       one(timeSlots, { fields: [lessons.timeSlotId], references: [timeSlots.id] }),
  lessonStudents: many(lessonStudents),
  notes:          many(studentNotes),
}))

export const lessonStudentsRelations = relations(lessonStudents, ({ one }) => ({
  lesson:  one(lessons, { fields: [lessonStudents.lessonId], references: [lessons.id] }),
  student: one(students, { fields: [lessonStudents.studentId], references: [students.id] }),
  package: one(packages, { fields: [lessonStudents.packageId], references: [packages.id] }),
}))

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  subjects: many(bookingSubjects),
  user:     one(users, { fields: [bookings.userId], references: [users.id] }),
  student:  one(students, { fields: [bookings.studentId], references: [students.id] }),
}))

export const studentNotesRelations = relations(studentNotes, ({ one }) => ({
  student: one(students, { fields: [studentNotes.studentId], references: [students.id] }),
  author:  one(users, { fields: [studentNotes.authorId], references: [users.id] }),
  lesson:  one(lessons, { fields: [studentNotes.lessonId], references: [lessons.id] }),
}))

export const bookingSubjectsRelations = relations(bookingSubjects, ({ one }) => ({
  booking:       one(bookings, { fields: [bookingSubjects.bookingId], references: [bookings.id] }),
  assignedTutor: one(users, { fields: [bookingSubjects.assignedTutorId], references: [users.id] }),
}))
