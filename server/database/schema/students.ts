import { pgTable, text, varchar, boolean, timestamp, date, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { cuid } from './common'
import { users } from './users'

export const students = pgTable('students', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName:  varchar('last_name', { length: 100 }).notNull(),

  classe: varchar('classe', { length: 50 }),
  scuola: varchar('scuola', { length: 100 }),

  // Giorno civile di nascita 'AAAA-MM-GG'. MAI timestamptz (come closureDates.date e
  // tutorAvailabilities.date): con l'ora dentro, il compleanno di chi è nato a
  // mezzanotte slitta di un giorno a seconda del fuso, e il campanellino
  // festeggerebbe la persona sbagliata. Facoltativo: di molti alunni non la sappiamo.
  dataNascita: date('data_nascita', { mode: 'string' }),

  studentPhone: varchar('student_phone', { length: 20 }),
  studentEmail: varchar('student_email', { length: 255 }),

  // ── PRIMO GENITORE / TUTORE ──
  // È la riga "storica": tutta la fatturazione (codice fiscale, partita IVA,
  // indirizzo) legge da qui e continua a farlo. Resta l'intestatario predefinito.
  parentName:      varchar('parent_name', { length: 200 }),
  parentEmail:     varchar('parent_email', { length: 255 }),
  parentPhone:     varchar('parent_phone', { length: 20 }),
  parentIndirizzo: text('parent_indirizzo'),
  parentCitta:     varchar('parent_citta', { length: 100 }),
  parentCap:       varchar('parent_cap', { length: 10 }),
  parentCF:        varchar('parent_cf', { length: 20 }),
  parentPIva:      varchar('parent_piva', { length: 20 }),
  // "Madre", "Padre", "Tutore legale"… stesso testo libero da 50 caratteri di
  // student_parents.relazione, così le due etichette restano confrontabili.
  parentRelazione: varchar('parent_relazione', { length: 50 }),

  // ── SECONDO GENITORE / TUTORE ──
  // PERCHÉ UNA SECONDA SERIE DI COLONNE E NON UNA TABELLA "TUTORI":
  // 1. È puramente additiva: nessuna riga esistente cambia, e ogni punto del
  //    gestionale che oggi legge "il genitore" (fatture, pagamenti, stampe,
  //    esportazioni) continua a leggere la PRIMA serie senza una sola modifica.
  //    Normalizzando avremmo dovuto riscrivere tutti quei punti, con il rischio
  //    di toccare fatture e pagamenti già registrati.
  // 2. Il limite di DUE è voluto, non una scorciatoia: la segreteria registra il
  //    genitore/tutore che paga e, al massimo, il secondo (genitori separati, o
  //    entrambi da tenere aggiornati). Chi ha bisogno di più persone collegate usa
  //    gli account del portale (student_parents), che sono già N-a-N.
  // Se un giorno servissero tre o più intestatari, allora sì che varrebbe la pena
  // normalizzare: fino a due, questa forma costa meno e non mette a rischio nulla.
  parent2Name:        varchar('parent2_name', { length: 200 }),
  parent2Email:       varchar('parent2_email', { length: 255 }),
  parent2Phone:       varchar('parent2_phone', { length: 20 }),
  parent2Indirizzo:   text('parent2_indirizzo'),
  parent2Citta:       varchar('parent2_citta', { length: 100 }),
  parent2Cap:         varchar('parent2_cap', { length: 10 }),
  parent2CF:          varchar('parent2_cf', { length: 20 }),
  parent2PIva:        varchar('parent2_piva', { length: 20 }),
  // Giorno civile 'AAAA-MM-GG' come students.dataNascita: mai timestamptz, o il
  // compleanno di chi è nato a mezzanotte slitta di un giorno col fuso orario.
  parent2DataNascita: date('parent2_data_nascita', { mode: 'string' }),
  parent2Relazione:   varchar('parent2_relazione', { length: 50 }),

  active:          boolean('active').notNull().default(true),
  note:            text('note'),
  bisogniSpeciali: text('bisogni_speciali'),

  // Account personale dello STUDENTE (solo prenotazioni). Attivo di default alla
  // creazione; per disattivarlo si usa users.active del relativo utente.
  studentUserId:               text('student_user_id').references(() => users.id, { onDelete: 'set null' }),
  abilitatoPrenotazioneOnline: boolean('abilitato_prenotazione_online').notNull().default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  activeNameIdx:  index('students_active_name_idx').on(t.active, t.lastName, t.firstName),
}))

export const studentReferrals = pgTable('student_referrals', {
  id:         text('id').primaryKey().$defaultFn(cuid),
  referredId: text('referred_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  referrerId: text('referrer_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniquePair:  uniqueIndex('referral_unique_pair').on(t.referredId, t.referrerId),
  referredIdx: index('referral_referred_idx').on(t.referredId),
  referrerIdx: index('referral_referrer_idx').on(t.referrerId),
}))

// Collegamento N-a-N tra un alunno e i suoi genitori con accesso al portale famiglie
// (es. genitori separati: ognuno ha il proprio account e vede lo stesso figlio).
export const studentParents = pgTable('student_parents', {
  id:           text('id').primaryKey().$defaultFn(cuid),
  studentId:    text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  parentUserId: text('parent_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  relazione:    varchar('relazione', { length: 50 }), // "Padre", "Madre", "Tutore legale", testo libero
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniquePair: uniqueIndex('student_parents_unique_pair').on(t.studentId, t.parentUserId),
  studentIdx: index('student_parents_student_idx').on(t.studentId),
  parentIdx:  index('student_parents_parent_idx').on(t.parentUserId),
}))
