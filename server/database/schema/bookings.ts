import { pgTable, text, varchar, timestamp, index } from 'drizzle-orm/pg-core'
import { cuid, bookingStatusEnum } from './common'
import { users } from './users'
import { students } from './students'

export const bookings = pgTable('bookings', {
  id:             text('id').primaryKey().$defaultFn(cuid),
  userId: text('user_id').notNull().references(() => users.id),
  studentId: text('student_id').references(() => students.id, { onDelete: 'set null' }),

  studentName:    varchar('student_name', { length: 100 }).notNull(),
  studentSurname: varchar('student_surname', { length: 100 }).notNull(),
  studentPhone:   varchar('student_phone', { length: 20 }).notNull(),

  requestedDate: timestamp('requested_date', { withTimezone: true }).notNull(),
  notes:         text('notes'),

  status: bookingStatusEnum('status').notNull().default('PENDING'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusDateIdx: index('bookings_status_date_idx').on(t.status, t.requestedDate),
  userIdx:       index('bookings_user_idx').on(t.userId),
  studentIdx:    index('bookings_student_idx').on(t.studentId),
}))

export const bookingSubjects = pgTable('booking_subjects', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  name:      varchar('name', { length: 100 }).notNull(),
  bookingId: text('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),

  assignedTutorId: text('assigned_tutor_id').references(() => users.id),
  assignedSlot:    varchar('assigned_slot', { length: 20 }),
  assignedAt:      timestamp('assigned_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  bookingIdx:      index('booking_subjects_booking_idx').on(t.bookingId),
  assignedTutorIdx: index('booking_subjects_tutor_idx').on(t.assignedTutorId),
}))
