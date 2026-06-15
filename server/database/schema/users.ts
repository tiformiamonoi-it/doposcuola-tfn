import { pgTable, text, varchar, boolean, timestamp, uniqueIndex, index, numeric } from 'drizzle-orm/pg-core'
import { cuid, userRoleEnum, tutorPaymentModeEnum } from './common'

export const users = pgTable('users', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  email:     varchar('email', { length: 255 }).notNull().unique(),
  password:  text('password').notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName:  varchar('last_name', { length: 100 }).notNull(),
  role:      userRoleEnum('role').notNull().default('TUTOR'),
  phone:     varchar('phone', { length: 20 }),
  active:    boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex('users_email_idx').on(t.email),
}))

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
  modalitaPagamento: tutorPaymentModeEnum('modalita_pagamento').notNull().default('ORE'),
  importoForfait:    numeric('importo_forfait', { precision: 10, scale: 2 }),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const tutorAvailabilities = pgTable('tutor_availabilities', {
  id:     text('id').primaryKey().$defaultFn(cuid),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date:   timestamp('date', { withTimezone: true }).notNull(),
  notes:  text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueUserDate: uniqueIndex('availability_user_date_unique').on(t.userId, t.date),
  dateIdx:        index('availability_date_idx').on(t.date),
}))
