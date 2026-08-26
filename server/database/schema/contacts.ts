import { pgTable, text, varchar, boolean, timestamp, date, index } from 'drizzle-orm/pg-core'
import {
  cuid,
  contactTipoEnum,
  contactCanaleEnum,
  contactStatoEnum,
  contactMarketingRuoloEnum,
  contactDoposcuolaRuoloEnum,
  interactionTipoEnum,
  interactionDirezioneEnum,
  interactionEsitoEnum,
} from './common'
import { users } from './users'
import { students } from './students'
import { contactRequests } from './system'

// LA RUBRICA — una riga per ogni persona che ci ha scritto/chiamato o che ci interessa.
export const contacts = pgTable('contacts', {
  id: text('id').primaryKey().$defaultFn(cuid),

  // Decide in quale tab compare (Doposcuola / Marketing)
  tipo:    contactTipoEnum('tipo').notNull(),
  nome:    varchar('nome', { length: 100 }).notNull(),
  cognome: varchar('cognome', { length: 100 }),

  // Telefono sempre normalizzato +39… (shared/phone.ts) per non creare doppioni
  telefono: varchar('telefono', { length: 20 }),
  email:    varchar('email', { length: 255 }),
  // link al profilo o @nomeutente: per chi scrive solo in chat social
  socialLink: varchar('social_link', { length: 300 }),

  canaleOrigine: contactCanaleEnum('canale_origine').notNull().default('ALTRO'),
  stato:         contactStatoEnum('stato').notNull().default('NUOVO'),

  // Giorno civile in cui richiamare, 'YYYY-MM-DD' (convenzione di progetto: mai
  // timestamptz per le date-giorno, altrimenti la data si sfasa di un giorno)
  prossimoRicontatto: date('prossimo_ricontatto', { mode: 'string' }),
  // Copia dell'ultima interazione: ordina la lista senza join sul diario
  ultimoContattoAt:   timestamp('ultimo_contatto_at', { withTimezone: true }),

  note: text('note'),

  // Solo Doposcuola
  nomeStudente: varchar('nome_studente', { length: 200 }),
  classeScuola: varchar('classe_scuola', { length: 200 }),
  materie:      varchar('materie', { length: 500 }),

  // Solo Marketing
  azienda:           varchar('azienda', { length: 200 }),
  servizioInteresse: varchar('servizio_interesse', { length: 200 }),
  marketingRuolo:    contactMarketingRuoloEnum('marketing_ruolo'),

  // Solo Doposcuola: famiglia interessata (STUDENTE) o candidato tutor (TUTOR)
  doposcuolaRuolo:   contactDoposcuolaRuoloEnum('doposcuola_ruolo').notNull().default('STUDENTE'),

  // GDPR: spunta "informativa privacy comunicata"
  privacyInformata: boolean('privacy_informata').notNull().default(false),

  studentId:        text('student_id').references(() => students.id, { onDelete: 'set null' }),
  contactRequestId: text('contact_request_id').references(() => contactRequests.id, { onDelete: 'set null' }),
  createdByUserId:  text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),

  convertitoAt: timestamp('convertito_at', { withTimezone: true }),
  // Cestino "morbido": se valorizzato il contatto è nascosto, mai cancellato davvero
  archiviatoAt: timestamp('archiviato_at', { withTimezone: true }),
  // Pulizia privacy: quando i dati personali di un contatto "Perso" sono stati
  // cancellati (dopo 12 mesi). Se valorizzata, la scheda non è più modificabile.
  anonimizzatoAt: timestamp('anonimizzato_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tipoStatoIdx:          index('contacts_tipo_stato_idx').on(t.tipo, t.stato),
  prossimoRicontattoIdx: index('contacts_prossimo_ricontatto_idx').on(t.prossimoRicontatto),
  telefonoIdx:           index('contacts_telefono_idx').on(t.telefono),
  emailIdx:              index('contacts_email_idx').on(t.email),
  archiviatoIdx:         index('contacts_archiviato_idx').on(t.archiviatoAt),
}))

// IL DIARIO — una riga per ogni chiamata/messaggio scambiato con un contatto.
export const contactInteractions = pgTable('contact_interactions', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),

  tipo:      interactionTipoEnum('tipo').notNull(),
  // RICEVUTA = ci ha contattato lui · EFFETTUATA = lo abbiamo contattato noi
  direzione: interactionDirezioneEnum('direzione').notNull(),
  canale:    contactCanaleEnum('canale').notNull(),
  esito:     interactionEsitoEnum('esito'),

  note: text('note'),
  data: timestamp('data', { withTimezone: true }).notNull().defaultNow(),

  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  contactDataIdx: index('contact_interactions_contact_data_idx').on(t.contactId, t.data),
}))
