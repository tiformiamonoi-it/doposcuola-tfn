import { pgTable, text, varchar, timestamp, date, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { cuid, confirmationStatusEnum } from './common'
import { users } from './users'
import { students } from './students'

// IL QUADERNO DELL'APPELLO — una riga per (alunno, anno scolastico).
// Chi non ha ancora una riga vale "Da sentire": il quaderno si riempie da solo,
// man mano che si segnano le risposte. Le pagine degli anni passati restano.
export const studentConfirmations = pgTable('student_confirmations', {
  id: text('id').primaryKey().$defaultFn(cuid),

  // Anno scolastico in forma '2026/2027' (9 caratteri)
  anno:      varchar('anno', { length: 9 }).notNull(),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),

  stato: confirmationStatusEnum('stato').notNull().default('DA_SENTIRE'),

  // Giorno civile della risposta, 'YYYY-MM-DD' (convenzione di progetto: mai
  // timestamptz per le date-giorno, altrimenti la data si sfasa di un giorno)
  dataRisposta: date('data_risposta', { mode: 'string' }),

  note: text('note'),

  aggiornatoDaUserId: text('aggiornato_da_user_id').references(() => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Una sola risposta per alunno per anno: è la chiave dell'upsert
  annoStudentUnique: uniqueIndex('student_confirmations_anno_student_unique').on(t.anno, t.studentId),
  annoStatoIdx:      index('student_confirmations_anno_stato_idx').on(t.anno, t.stato),
  studentIdx:        index('student_confirmations_student_idx').on(t.studentId),
}))
