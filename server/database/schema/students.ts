import { pgTable, text, varchar, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { cuid } from './common'
import { users } from './users'

export const students = pgTable('students', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName:  varchar('last_name', { length: 100 }).notNull(),

  classe: varchar('classe', { length: 50 }),
  scuola: varchar('scuola', { length: 100 }),

  studentPhone: varchar('student_phone', { length: 20 }),
  studentEmail: varchar('student_email', { length: 255 }),

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

  portalUserId:                text('portal_user_id').references(() => users.id, { onDelete: 'set null' }),
  // Account personale dello STUDENTE (solo prenotazioni). Attivo di default alla
  // creazione; per disattivarlo si usa users.active del relativo utente.
  studentUserId:               text('student_user_id').references(() => users.id, { onDelete: 'set null' }),
  abilitatoPrenotazioneOnline: boolean('abilitato_prenotazione_online').notNull().default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  activeNameIdx:  index('students_active_name_idx').on(t.active, t.lastName, t.firstName),
  portalUserIdx:  index('students_portal_user_idx').on(t.portalUserId),
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
