import { pgTable, text, varchar, timestamp, index } from 'drizzle-orm/pg-core'
import { cuid, contactRequestStatusEnum } from './common'

export const closureDates = pgTable('closure_dates', {
  id:          text('id').primaryKey().$defaultFn(cuid),
  date:        timestamp('date', { withTimezone: true }).notNull().unique(),
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
