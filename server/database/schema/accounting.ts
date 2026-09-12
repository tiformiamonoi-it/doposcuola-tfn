import { pgTable, text, varchar, boolean, timestamp, index, numeric, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { cuid, accountingTypeEnum, paymentMethodEnum, tutorPaymentStatusEnum, reimbursementStatusEnum } from './common'
import { users } from './users'
import { packages, payments } from './packages'
import { lessons } from './lessons'

export const tutorPayments = pgTable('tutor_payments', {
  id:      text('id').primaryKey().$defaultFn(cuid),
  tutorId: text('tutor_id').notNull().references(() => users.id),

  mese:    timestamp('mese', { withTimezone: true }).notNull(),
  importo: numeric('importo', { precision: 10, scale: 2 }).notNull(),

  dataPagamento: timestamp('data_pagamento', { withTimezone: true }).notNull().defaultNow(),
  metodo:        paymentMethodEnum('metodo').notNull().default('BONIFICO'),
  status:        tutorPaymentStatusEnum('status').notNull().default('PAGATO'),
  note:          text('note'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tutorMeseIdx: index('tutor_payments_tutor_mese_idx').on(t.tutorId, t.mese),
}))

export const tutorReimbursements = pgTable('tutor_reimbursements', {
  id:      text('id').primaryKey().$defaultFn(cuid),
  tutorId: text('tutor_id').notNull().references(() => users.id),

  importo:       numeric('importo', { precision: 10, scale: 2 }).notNull(),
  importoPagato: numeric('importo_pagato', { precision: 10, scale: 2 }).notNull().default('0'),
  descrizione:   text('descrizione').notNull(),

  dataRichiesta: timestamp('data_richiesta', { withTimezone: true }).notNull().defaultNow(),
  dataPagamento: timestamp('data_pagamento', { withTimezone: true }),

  stato:  reimbursementStatusEnum('stato').notNull().default('DA_PAGARE'),
  metodo: paymentMethodEnum('metodo'),
  note:   text('note'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tutorStatoIdx: index('reimbursements_tutor_stato_idx').on(t.tutorId, t.stato),
}))

export const accountingEntries = pgTable('accounting_entries', {
  id:          text('id').primaryKey().$defaultFn(cuid),
  tipo:        accountingTypeEnum('tipo').notNull(),
  importo:     numeric('importo', { precision: 10, scale: 2 }).notNull(),
  descrizione: text('descrizione').notNull(),
  categoria:   varchar('categoria', { length: 100 }),
  data:        timestamp('data', { withTimezone: true }).notNull().defaultNow(),

  packageId:      text('package_id').references(() => packages.id, { onDelete: 'set null' }),
  lessonId:       text('lesson_id').references(() => lessons.id, { onDelete: 'set null' }),
  paymentId:       text('payment_id').references(() => payments.id, { onDelete: 'cascade' }).unique(),
  tutorPaymentId:  text('tutor_payment_id').references(() => tutorPayments.id, { onDelete: 'cascade' }).unique(),
  reimbursementId: text('reimbursement_id').references(() => tutorReimbursements.id, { onDelete: 'cascade' }),

  metodoPagamento: paymentMethodEnum('metodo_pagamento'),
  fatturaEmessa:   boolean('fattura_emessa').notNull().default(false),
  // Fattura richiesta su movimenti MANUALI (per i pagamenti pacchetto fa fede payments.richiedeFattura)
  richiedeFattura: boolean('richiede_fattura').notNull().default(false),
  // Gemello dei movimenti accoppiati "Proventi diversi" e "Bollo": cancellare uno cancella l'altro (FK cascade)
  linkedEntryId:   text('linked_entry_id').references((): AnyPgColumn => accountingEntries.id, { onDelete: 'cascade' }),
  // Bollo (F1): su un DEBITO "bollo da versare" indica QUALE versamento F24 lo ha chiuso.
  // Serve una colonna sua perché linkedEntryId è già occupato dalla gemella entrata↔debito.
  // Vuota = bollo ancora aperto (è così che si trovano i bolli da versare).
  // ON DELETE SET NULL e non CASCADE: se un giorno si cancella l'F24, i bolli devono
  // tornare "da versare", non sparire insieme a lui.
  versamentoEntryId: text('versamento_entry_id').references((): AnyPgColumn => accountingEntries.id, { onDelete: 'set null' }),
  note:            text('note'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tipoDataIdx:    index('acc_tipo_data_idx').on(t.tipo, t.data),
  categoriaIdx:   index('acc_categoria_idx').on(t.categoria),
  metodoIdx:      index('acc_metodo_idx').on(t.metodoPagamento),
  tutorPaymentIdx:  index('acc_tutor_payment_idx').on(t.tutorPaymentId),
  reimbursementIdx: index('acc_reimbursement_idx').on(t.reimbursementId),
  // La card "Bolli da versare" cerca sempre la stessa cosa: categoria bollo +
  // versamento ancora vuoto. Con questo indice la risposta resta immediata anche
  // quando i bolli registrati saranno migliaia.
  versamentoIdx:    index('acc_versamento_idx').on(t.versamentoEntryId),
}))
