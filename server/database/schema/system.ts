import { pgTable, text, varchar, timestamp, date, index } from 'drizzle-orm/pg-core'
import { cuid, contactRequestStatusEnum, notificaTipoEnum } from './common'
import { users } from './users'

export const closureDates = pgTable('closure_dates', {
  id:          text('id').primaryKey().$defaultFn(cuid),
  // Giorno civile 'YYYY-MM-DD' (convenzione di progetto: mai timestamptz per le date-giorno)
  date:        date('date').notNull().unique(),
  description: text('description'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  dateIdx: index('closure_date_idx').on(t.date),
}))

export const systemConfigs = pgTable('system_configs', {
  id:          text('id').primaryKey().$defaultFn(cuid),
  key:         varchar('key', { length: 100 }).notNull().unique(),
  value:       text('value').notNull(),
  description: text('description'),
  category:    varchar('category', { length: 50 }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  categoryIdx: index('system_configs_category_idx').on(t.category),
}))

// IL CENTRO NOTIFICHE (il campanellino in alto).
//
// LA LETTURA È DI SQUADRA, NON PERSONALE: se un admin segna una notifica come
// letta, sparisce per tutti. In segreteria sono 2-3 persone che lavorano sulle
// stesse cose: uno stato "letto" separato per ognuna significherebbe che la
// stessa pratica va chiusa tre volte, e che tre persone la richiamano per non
// sbagliarsi. Un solo stato condiviso ("qualcuno se n'è occupato") è più semplice
// da capire e da programmare, e non toglie niente: chi ha segnato la riga resta
// scritto in lettaDaUserId. Se un giorno lo staff diventasse grande, servirebbe
// una tabella a parte (notifica × utente): oggi sarebbe complicazione a vuoto.
//
// I COMPLEANNI NON STANNO QUI: si calcolano al volo da data_nascita (vedi
// notifiche.service.ts). Salvare un compleanno vorrebbe dire scrivere una riga
// nuova ogni anno per ogni persona, e correggere una data di nascita non
// sistemerebbe le righe già scritte.
export const notifiche = pgTable('notifiche', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  tipo:      notificaTipoEnum('tipo').notNull().default('GENERICA'),
  titolo:    varchar('titolo', { length: 200 }).notNull(),
  messaggio: text('messaggio').notNull(),
  // Dove portare chi clicca sull'avviso, es. '/studenti/abc123'. Nullable:
  // un avviso può essere solo da leggere.
  link:      varchar('link', { length: 500 }),

  // A che cosa si riferisce l'avviso, es. entityType 'student' + entityId.
  // Serve a non creare due volte lo stesso avviso per la stessa pratica.
  entityType: varchar('entity_type', { length: 50 }),
  entityId:   text('entity_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // NULL = ancora da leggere. Le notifiche lette non si cancellano: restano
  // consultabili come storico ("le ultime N lette").
  lettaAt:       timestamp('letta_at', { withTimezone: true }),
  lettaDaUserId: text('letta_da_user_id').references(() => users.id, { onDelete: 'set null' }),
}, (t) => ({
  // L'unica lettura frequente è "le non lette, dalla più recente": indice fatto
  // su misura per quella, così il campanellino resta immediato anche con lo
  // storico che cresce.
  daLeggereIdx: index('notifiche_da_leggere_idx').on(t.lettaAt, t.createdAt),
  entityIdx:    index('notifiche_entity_idx').on(t.entityType, t.entityId),
}))

export const contactRequests = pgTable('contact_requests', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  name:      varchar('name', { length: 150 }).notNull(),
  email:     varchar('email', { length: 255 }).notNull(),
  phone:     varchar('phone', { length: 20 }),
  message:   text('message').notNull(),
  status:    contactRequestStatusEnum('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
