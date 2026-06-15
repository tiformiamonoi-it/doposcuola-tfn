import { pgTable, text, varchar, boolean, timestamp, index, numeric, integer } from 'drizzle-orm/pg-core'
import { cuid, packageTypeEnum, packageStatusEnum, paymentTypeEnum, paymentMethodEnum } from './common'
import { students } from './students'

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

  tariffaOraria:     numeric('tariffa_oraria', { precision: 10, scale: 2 }),

  active:    boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  categoriaTipoIdx: index('std_pkg_categoria_tipo_idx').on(t.categoria, t.tipo),
}))

export const packages = pgTable('packages', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  standardPackageId: text('standard_package_id').references(() => standardPackages.id, { onDelete: 'set null' }),

  nome: varchar('nome', { length: 200 }).notNull(),
  tipo: packageTypeEnum('tipo').notNull().default('ORE'),

  oreAcquistate:     numeric('ore_acquistate', { precision: 10, scale: 2 }).notNull(),
  oreResiduo:        numeric('ore_residuo', { precision: 10, scale: 2 }).notNull(),
  orePerse:          numeric('ore_perse', { precision: 10, scale: 2 }).notNull().default('0'),

  giorniAcquistati:  integer('giorni_acquistati'),
  giorniResiduo:     integer('giorni_residuo'),
  orarioGiornaliero: numeric('orario_giornaliero', { precision: 10, scale: 2 }),

  tariffaOraria:     numeric('tariffa_oraria', { precision: 10, scale: 2 }),

  prezzoTotale:   numeric('prezzo_totale', { precision: 10, scale: 2 }).notNull(),
  importoPagato:  numeric('importo_pagato', { precision: 10, scale: 2 }).notNull().default('0'),
  importoResiduo: numeric('importo_residuo', { precision: 10, scale: 2 }).notNull(),

  dataInizio:   timestamp('data_inizio', { withTimezone: true }).notNull(),
  dataScadenza: timestamp('data_scadenza', { withTimezone: true }),

  stati: packageStatusEnum('stati').array().notNull().default(['ATTIVO']),

  note:      text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  studentStatiIdx: index('pkg_student_stati_idx').on(t.studentId, t.stati),
  tipoCreatedIdx:  index('pkg_tipo_created_idx').on(t.tipo, t.createdAt),
  statiGinIdx:     index('pkg_stati_gin_idx').using('gin', t.stati),
}))

export const payments = pgTable('payments', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  packageId: text('package_id').notNull().references(() => packages.id, { onDelete: 'cascade' }),

  importo:         numeric('importo', { precision: 10, scale: 2 }).notNull(),
  tipoPagamento:   paymentTypeEnum('tipo_pagamento').notNull().default('ACCONTO'),
  metodoPagamento: paymentMethodEnum('metodo_pagamento').notNull().default('CONTANTI'),

  richiedeFattura: boolean('richiede_fattura').notNull().default(false),
  dataPagamento:   timestamp('data_pagamento', { withTimezone: true }).notNull().defaultNow(),
  riferimento:     text('riferimento'),
  note:            text('note'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pkgDateIdx: index('payments_pkg_date_idx').on(t.packageId, t.dataPagamento),
}))

export const packageRecharges = pgTable('package_recharges', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  packageId: text('package_id').notNull().references(() => packages.id, { onDelete: 'cascade' }),

  ore:           numeric('ore', { precision: 10, scale: 2 }).notNull(),
  tariffaOraria: numeric('tariffa_oraria', { precision: 10, scale: 2 }).notNull(),
  importo:       numeric('importo', { precision: 10, scale: 2 }).notNull(),

  data:      timestamp('data', { withTimezone: true }).notNull().defaultNow(),
  paymentId: text('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  note:      text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  packageDataIdx: index('recharges_package_data_idx').on(t.packageId, t.data),
}))
