import { pgTable, text, varchar, boolean, timestamp, date, integer, index } from 'drizzle-orm/pg-core'
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

  // Solo Doposcuola — colonne STORICHE: dal blocco 4 i figli di una famiglia
  // stanno in contact_figli (qui sotto), uno per riga. Restano solo perché il sito
  // online, finché non si aggiorna, le usa ancora: toglierle subito lo romperebbe.
  // Si tolgono nella pulizia finale. Il codice nuovo le legge solo come ripiego
  // (vedi figliConRipiego in contact.service.ts) e non ci scrive più niente.
  nomeStudente: varchar('nome_studente', { length: 200 }),
  classeScuola: varchar('classe_scuola', { length: 200 }),
  // Questa invece resta viva per i candidati tutor: le materie che INSEGNANO.
  // Per le famiglie è storica come le due sopra (le materie stanno su ogni figlio).
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
  // Il gemello di studentId per i candidati tutor: l'account creato con "Crea tutor"
  // dalla scheda contatto. Se un giorno quell'account venisse cancellato il contatto
  // resta, solo senza collegamento (set null), esattamente come per lo studente.
  tutorUserId:      text('tutor_user_id').references(() => users.id, { onDelete: 'set null' }),
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

// I FIGLI DI UNA FAMIGLIA — una riga per ogni ragazzo per cui ci hanno cercato.
// Prima c'erano tre campi sul contatto e quindi un figlio solo: se una mamma
// chiamava per due figli bisognava duplicare il contatto o scrivere tutto nelle
// note. Ogni figlio diventa alunno per conto suo ("Crea studente" riga per riga):
// per questo il collegamento allo studente sta qui, su ogni figlio.
// Vale solo per i contatti Doposcuola "Possibile studente".
export const contactFigli = pgTable('contact_figli', {
  id:        text('id').primaryKey().$defaultFn(cuid),
  // Cancellando il contatto spariscono anche i suoi figli (oggi i contatti non si
  // cancellano mai davvero, ma la regola giusta è questa)
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),

  // Il nome può mancare: dei contatti di prima a volte si sapeva solo la classe
  nome:         varchar('nome', { length: 200 }),
  classeScuola: varchar('classe_scuola', { length: 200 }),
  materie:      varchar('materie', { length: 500 }),

  // Lo studente nato da questo figlio con "Crea studente". Se un giorno lo studente
  // venisse cancellato, il figlio resta nel contatto, solo scollegato (set null).
  studentId: text('student_id').references(() => students.id, { onDelete: 'set null' }),

  // L'ordine in cui sono stati scritti: il primo figlio resta il primo
  ordine: integer('ordine').notNull().default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // I figli di un contatto, già nell'ordine giusto (lista e scheda)
  contactOrdineIdx: index('contact_figli_contact_ordine_idx').on(t.contactId, t.ordine),
  // "Questo alunno viene dai Contatti?" (card dei Rientri)
  studentIdx:       index('contact_figli_student_idx').on(t.studentId),
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
