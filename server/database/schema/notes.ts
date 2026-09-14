import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'
import { cuid, noteVisibilitaEnum } from './common'
import { users } from './users'
import { students } from './students'
import { lessons } from './lessons'

export const studentNotes = pgTable('student_notes', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  authorId:  text('author_id').notNull().references(() => users.id),

  contenuto:  text('contenuto').notNull(),
  visibilita: noteVisibilitaEnum('visibilita').notNull().default('INTERNA'),

  // Nota FAMIGLIA scritta da un TUTOR: null = in attesa di approvazione (ADMIN/SUPER_TUTOR).
  // Le note INTERNA e quelle scritte da ADMIN/SUPER_TUTOR nascono già approvate.
  approvataAt: timestamp('approvata_at', { withTimezone: true }),

  // Quando la famiglia è stata avvisata per email che questa nota è nel portale
  // (riepilogo serale delle 20, vedi note-digest.service.ts). null = mai avvisata.
  //
  // PERCHE' una colonna e non un semplice "guarda se è già girato oggi": il cron
  // può partire due volte (riavvio della funzione su Vercel, doppia chiamata,
  // prova manuale della segreteria) e la famiglia non deve ricevere due email
  // per la stessa comunicazione. Segnando la NOTA — e non la giornata — la
  // garanzia vale a prescindere da quante volte il riepilogo gira: la seconda
  // volta non trova più niente da dire e non manda niente.
  // È lo stesso rimedio, allo stesso problema, di packages.avvisoOreInviatoAt.
  avvisoInviatoAt: timestamp('avviso_inviato_at', { withTimezone: true }),

  lessonId: text('lesson_id').references(() => lessons.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  studentIdx:    index('notes_student_idx').on(t.studentId),
  authorIdx:     index('notes_author_idx').on(t.authorId),
  visibilitaIdx: index('notes_visibilita_idx').on(t.visibilita),
}))
