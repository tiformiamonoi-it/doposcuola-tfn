import { pgTable, text, varchar, boolean, timestamp, uniqueIndex, index, numeric } from 'drizzle-orm/pg-core'
import { cuid, lessonTypeEnum } from './common'
import { users } from './users'
import { students } from './students'
import { packages } from './packages'

export const timeSlots = pgTable('time_slots', {
  id:          text('id').primaryKey().$defaultFn(cuid),
  oraInizio:   varchar('ora_inizio', { length: 5 }).notNull(),
  oraFine:     varchar('ora_fine', { length: 5 }).notNull(),
  descrizione: text('descrizione'),
  active:      boolean('active').notNull().default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueSlot: uniqueIndex('time_slots_unique').on(t.oraInizio, t.oraFine),
}))

export const lessons = pgTable('lessons', {
  id:         text('id').primaryKey().$defaultFn(cuid),
  tutorId:    text('tutor_id').notNull().references(() => users.id),
  timeSlotId: text('time_slot_id').notNull().references(() => timeSlots.id),
  data:       timestamp('data', { withTimezone: true }).notNull(),

  tipo:        lessonTypeEnum('tipo').notNull().default('SINGOLA'),
  mezzaLezione: boolean('mezza_lezione').notNull().default(false),
  forzaGruppo: boolean('forza_gruppo').notNull().default(false),

  compensoTutor: numeric('compenso_tutor', { precision: 10, scale: 2 }),

  note:      text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  dataTutorIdx: index('lessons_data_tutor_idx').on(t.data, t.tutorId),
  tutorDataIdx: index('lessons_tutor_data_idx').on(t.tutorId, t.data),
}))

export const lessonStudents = pgTable('lesson_students', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  lessonId:  text('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  packageId: text('package_id').notNull().references(() => packages.id, { onDelete: 'cascade' }),

  oreScalate:   numeric('ore_scalate', { precision: 10, scale: 2 }).notNull().default('1.0'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueLessonStudent: uniqueIndex('ls_unique').on(t.lessonId, t.studentId),
  studentIdx:          index('ls_student_idx').on(t.studentId),
  packageStudentIdx:   index('ls_package_student_idx').on(t.packageId, t.studentId),
}))
