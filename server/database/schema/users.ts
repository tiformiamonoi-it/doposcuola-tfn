import { pgTable, text, varchar, boolean, timestamp, date, uniqueIndex, index, numeric, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { cuid, userRoleEnum, tutorPaymentModeEnum, passwordTokenScopoEnum } from './common'

export const users = pgTable('users', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  email:     varchar('email', { length: 255 }).notNull().unique(),
  password:  text('password').notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName:  varchar('last_name', { length: 100 }).notNull(),
  role:      userRoleEnum('role').notNull().default('TUTOR'),
  phone:     varchar('phone', { length: 20 }),
  active:    boolean('active').notNull().default(true),
  // Giorno civile di nascita 'AAAA-MM-GG' di chi ha un account: genitori del
  // portale, studenti con account, staff. MAI timestamptz — vedi il commento
  // gemello su students.dataNascita. Facoltativo.
  dataNascita: date('data_nascita', { mode: 'string' }),
  // Forza il cambio password al primo accesso (password temporanea/impostata dall'admin)
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  // Accettazione documenti legali (GENITORE: termini+privacy; STUDENTE: privacy studente)
  termsAcceptedAt:      timestamp('terms_accepted_at', { withTimezone: true }),
  termsAcceptedVersion: varchar('terms_accepted_version', { length: 40 }),
  // STUDENTE minorenne: quando il genitore ha autorizzato la creazione dell'account
  consensoGenitoreAt:   timestamp('consenso_genitore_at', { withTimezone: true }),
  // CHI della segreteria ha raccolto quell'autorizzazione. L'informativa privacy
  // promette "data e ora" del consenso: senza un nome, quella riga non è
  // dimostrabile a nessuno — resta un timestamp senza testimone.
  // Auto-riferimento a users: serve l'annotazione AnyPgColumn, come per
  // accountingEntries.linkedEntryId, altrimenti TypeScript va in ricorsione infinita.
  // onDelete 'set null': se l'operatore un giorno viene cancellato, il consenso
  // (data e ora) NON deve sparire con lui.
  consensoGenitoreRegistratoDaUserId: text('consenso_genitore_registrato_da_user_id')
    .references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  // Tutorial di benvenuto al primo accesso (tutor/famiglia/studente)
  tutorialVisto: boolean('tutorial_visto').notNull().default(false),
  // Portale famiglia: ultima visita alla pagina Note (per il badge "note non lette")
  noteLastSeenAt: timestamp('note_last_seen_at', { withTimezone: true }),
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
  // L'anagrafica del tutor sta qui (non su users, dove c'è solo l'accesso).
  // Giorno civile 'AAAA-MM-GG', mai timestamptz: vedi students.dataNascita.
  dataNascita:  date('data_nascita', { mode: 'string' }),
  materie:      text('materie').array().notNull().default([]),
  noteInterne:  text('note_interne'),
  modalitaPagamento: tutorPaymentModeEnum('modalita_pagamento').notNull().default('ORE'),
  importoForfait:    numeric('importo_forfait', { precision: 10, scale: 2 }),
  // DA QUANDO vale il fisso mensile: PRIMO GIORNO del mese di partenza ('AAAA-MM-01').
  //
  // Senza questa data il gestionale applicava il fisso a ogni mese in cui il tutor
  // avesse fatto lezione, passato compreso: un tutor pagato a ore da settembre a
  // dicembre e messo a 500 € oggi risultava creditore di 500 € anche per quei quattro
  // mesi. Arretrati mai esistiti (segnalato da Alessandro il 14/09/2026). I mesi
  // precedenti a questa data restano contati A ORE, come sono stati pagati davvero.
  //
  // Giorno civile (`date`), MAI timestamptz: vedi il commento gemello su
  // students.dataNascita. Un mese non è un istante, e passando da un timestamp con
  // fuso orario il 1° settembre delle 00:00 diventa il 31 agosto in mezza Europa —
  // cioè il fisso partirebbe un mese prima del dovuto.
  //
  // ⚠️ VUOTO NON VUOL DIRE "DA SEMPRE": se un tutor risulta FORFAIT ma qui non c'è
  // niente (sono i profili salvati prima del 14/09/2026), il fisso vale DAL MESE
  // CORRENTE IN AVANTI, mai per i mesi passati. È la regola che rende impossibile il
  // difetto anche sui dati vecchi che non possiamo controllare uno per uno; sta
  // scritta una volta sola in shared/compenso-tutor.ts e la usano tutti.
  forfaitDal:        date('forfait_dal', { mode: 'string' }),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const tutorAvailabilities = pgTable('tutor_availabilities', {
  id:     text('id').primaryKey().$defaultFn(cuid),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Giorno civile della disponibilità (solo data, senza ora né fuso orario)
  date:   date('date', { mode: 'string' }).notNull(),
  notes:  text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueUserDate: uniqueIndex('availability_user_date_unique').on(t.userId, t.date),
  dateIdx:        index('availability_date_idx').on(t.date),
}))

// I BIGLIETTI D'INGRESSO "scegli la tua password".
// Ogni riga è un link monouso e a tempo: si consuma quando l'utente sceglie
// la password (used_at) e comunque scade da solo (expires_at).
//
// NEL DATABASE NON FINISCE MAI IL TOKEN IN CHIARO, solo il suo SHA-256:
// se qualcuno riuscisse a leggere questa tabella (backup rubato, accesso di un
// fornitore, dump per errore) NON potrebbe ricostruire nessun link e quindi non
// potrebbe entrare in nessun account. L'unico che possiede il valore in chiaro è
// chi ha ricevuto il link — esattamente come per le password, salvate hashate.
export const passwordTokens = pgTable('password_tokens', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  userId:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // SHA-256 esadecimale del token: 64 caratteri, mai il token vero
  tokenHash: text('token_hash').notNull(),
  scopo:     passwordTokenScopoEnum('scopo').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  // Valorizzato quando il link viene usato (o invalidato da un link più recente):
  // NULL = ancora aperto. Le righe non si cancellano, restano come storico.
  usedAt:    timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // La ricerca avviene SEMPRE per hash: indice unico, così due link non possono
  // mai collidere e la lettura resta immediata anche con lo storico che cresce.
  tokenHashUnique: uniqueIndex('password_tokens_token_hash_unique').on(t.tokenHash),
  userIdx:         index('password_tokens_user_idx').on(t.userId),
}))
