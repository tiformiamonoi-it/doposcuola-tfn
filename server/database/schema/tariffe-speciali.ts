import { pgTable, text, numeric, date, timestamp, index } from 'drizzle-orm/pg-core'
import { cuid } from './common'
import { users } from './users'
import { students } from './students'

// IL QUADERNO DELLE TARIFFE SPECIALI DEI TUTOR.
//
// Ogni riga dice "in questa situazione il tutor prende tot €/ora". Tutor, alunno e
// fasce orarie sono tutti facoltativi (almeno uno c'è sempre: lo controlla lo schema
// Zod), e quando una lezione si salva vince la regola PIÙ PRECISA (vedi
// tariffe-speciali.service.ts). Senza regole vale il listino di sempre.
//
// Le regole NON ricalcolano niente: valgono per le lezioni salvate da quel momento.
export const tutorTariffeSpeciali = pgTable('tutor_tariffe_speciali', {
  id: text('id').primaryKey().$defaultFn(cuid),

  // Vuoto = qualsiasi tutor. 'cascade': se il tutor sparisce davvero dal database, una
  // regola che parla di lui non ha più senso.
  tutorId:   text('tutor_id').references(() => users.id, { onDelete: 'cascade' }),
  // Vuoto = qualsiasi alunno. Stessa ragione del tutor.
  studentId: text('student_id').references(() => students.id, { onDelete: 'cascade' }),

  // Fasce orarie (id di time_slots). Vuoto = tutte le fasce.
  // Un elenco dentro la riga invece di una tabella ponte: le fasce sono poche e si
  // leggono sempre insieme alla regola. Se una fascia viene cancellata il suo id resta
  // qui ma non corrisponde più a nessuna lezione, e la regola semplicemente non scatta.
  timeSlotIds: text('time_slot_ids').array().notNull().default([]),

  // €/ora, una sola cifra per qualsiasi tipo di lezione (singola, gruppo, MAXI).
  tariffaOraria: numeric('tariffa_oraria', { precision: 10, scale: 2 }).notNull(),

  // Da quale GIORNO vale, 'AAAA-MM-GG'. MAI timestamptz: è un giorno, non un istante,
  // e va confrontato con lessons.data che è anch'essa un giorno civile.
  validaDal: date('valida_dal', { mode: 'string' }).notNull(),

  nota: text('nota'),

  // Chi l'ha scritta. 'set null': se l'account sparisce, la regola resta.
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Le due domande che si fanno: "le regole di questo tutor" (scheda tutor, salvataggio
  // lezione) e "le regole di questo alunno" (scheda alunno).
  tutorIdx:   index('tutor_tariffe_speciali_tutor_idx').on(t.tutorId),
  studentIdx: index('tutor_tariffe_speciali_student_idx').on(t.studentId),
}))
