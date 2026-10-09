import { pgTable, text, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { cuid, comunicazioneTipoEnum } from './common'
import { users } from './users'

// LE COMUNICAZIONI A TUTTE LE FAMIGLIE (blocco 3 del piano di ottobre).
//
// È la bacheca all'ingresso: la segreteria scrive una volta, ogni genitore con il
// portale la trova nel portale e nella posta. Si firma sempre "Segreteria": chi
// l'ha scritta davvero (authorId) resta solo nello storico interno.
//
// Non si modifica dopo l'invio: le email sono già partite con quel testo, e una
// bacheca che dice una cosa diversa dalla posta confonderebbe le famiglie.
// "Eliminare" vuol dire solo toglierla dai portali (eliminataAt): le righe restano,
// così lo storico continua a dire il vero su chi l'ha ricevuta.
export const comunicazioni = pgTable('comunicazioni', {
  id: text('id').primaryKey().$defaultFn(cuid),

  titolo: varchar('titolo', { length: 150 }).notNull(),
  // Testo semplice, con gli a capo: niente HTML (nell'email viene "disinnescato").
  testo:  text('testo').notNull(),
  tipo:   comunicazioneTipoEnum('tipo').notNull(),

  // Chi l'ha mandata. 'set null': se l'account dello staff sparisce, lo storico resta.
  authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),

  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // null = visibile nei portali. Valorizzata = tolta dalla bacheca (le email no:
  // quelle una volta partite non si possono richiamare).
  eliminataAt: timestamp('eliminata_at', { withTimezone: true }),
}, (t) => ({
  // Lo storico si legge dalla più recente
  createdIdx: index('comunicazioni_created_idx').on(t.createdAt),
}))

// A CHI È ARRIVATA: una riga per genitore, scritta al momento dell'invio.
//
// PERCHÉ UNA FOTOGRAFIA e non "chi ha il portale oggi": un genitore che entra a
// novembre non deve trovarsi gli avvisi di settembre come se fossero suoi, e i
// numeri dello storico ("ricevuta da 120, letta da 80") non devono cambiare da
// soli col passare dei mesi.
export const comunicazioniDestinatari = pgTable('comunicazioni_destinatari', {
  id: text('id').primaryKey().$defaultFn(cuid),

  comunicazioneId: text('comunicazione_id').notNull().references(() => comunicazioni.id, { onDelete: 'cascade' }),
  // 'cascade': se l'account del genitore viene cancellato, la sua copia va via con lui.
  userId:          text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Quando il genitore l'ha vista nel portale (pallino "Nuova" spento). null = non letta.
  lettaAt:        timestamp('letta_at', { withTimezone: true }),
  // Quando l'email è partita. null = non (ancora) partita: "Riprova" ci ripassa sopra.
  emailInviataAt: timestamp('email_inviata_at', { withTimezone: true }),
  // L'ultimo motivo per cui l'email non è partita, in una riga leggibile.
  emailErrore:    text('email_errore'),
}, (t) => ({
  // Un genitore riceve la stessa comunicazione una volta sola
  unico:   uniqueIndex('comunicazioni_destinatari_unico_idx').on(t.comunicazioneId, t.userId),
  // "Le mie comunicazioni" e il pallino delle non lette, nel portale
  userIdx: index('comunicazioni_destinatari_user_idx').on(t.userId),
}))
