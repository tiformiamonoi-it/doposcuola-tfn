import { pgTable, text, varchar, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { cuid, consensoTipoEnum, consensoOrigineEnum } from './common'
import { users } from './users'
import { students } from './students'

// IL REGISTRO DEI CONSENSI — una riga per ogni CAMBIAMENTO, mai sovrascritta.
//
// PERCHÉ NON TRE CASELLINE SU students O SU users (che sarebbe stato più corto).
// Una casellina dice solo com'è adesso. Alla domanda «in che data ha revocato il
// consenso alle foto?» una casellina non sa rispondere, e quella domanda non è
// teorica: è esattamente ciò che un genitore (o il Garante) può chiedere. Qui
// invece non si cancella e non si modifica mai niente: si scrive una riga nuova.
// È il registro di magazzino, non la lavagnetta.
//
// LO STATO ATTUALE si ricava leggendo l'ULTIMA riga per ciascun tipo
// (consensi.service.ts → statoConsensi). Costa una lettura in più e vale la pena.
//
// A CHI APPARTIENE CIASCUN TIPO — è la ragione per cui studentId e userId sono
// tutti e due facoltativi:
//   • MINORE_14 e IMMAGINI riguardano L'ALUNNO → hanno studentId (e, quando si sa,
//     anche userId: il genitore che ha risposto).
//   • MARKETING riguarda LA PERSONA → ha userId e NON ha studentId. Se la mamma
//     revoca le promozioni, vale per lei: non ha senso "revocato per Luca ma non
//     per Giulia", sono la stessa casella di posta.
//
// QUESTE RIGHE NON SI CANCELLANO NEMMENO CON L'ANONIMIZZAZIONE (art. 17): sono la
// prova di che cosa è stato acconsentito e quando, e da sole non contengono nomi
// né recapiti — solo dei collegamenti. Se l'alunno viene cancellato davvero dal
// database (cosa che il gestionale non fa: anonimizza) il cascade le porta via con lui.
export const consensi = pgTable('consensi', {
  id: text('id').primaryKey().$defaultFn(cuid),

  tipo: consensoTipoEnum('tipo').notNull(),

  // L'alunno a cui il consenso si riferisce. NULLABLE perché il marketing non ha
  // un alunno: è della persona.
  studentId: text('student_id').references(() => students.id, { onDelete: 'cascade' }),

  // LA PERSONA a cui il consenso si riferisce (di solito il genitore).
  // NULLABLE: la segreteria può registrare l'autorizzazione di un genitore che
  // non ha (ancora) un account del portale. Per MARKETING nella pratica c'è
  // sempre, perché il marketing è di una persona e basta.
  // onDelete 'set null': se un giorno quell'account sparisce, la riga di consenso
  // NON deve sparire con lui — resta la prova di che cosa era stato detto.
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

  // true = consenso DATO · false = consenso REVOCATO.
  // Non c'è un "non risposto": quello è semplicemente l'assenza di righe.
  valore: boolean('valore').notNull(),

  // La versione del testo accettato (es. '2026-08-v4', come termsAcceptedVersion).
  // Serve a poter dire non solo QUANDO ha accettato, ma CHE COSA: un'informativa
  // aggiornata dopo non può essere spacciata per quella che aveva letto lui.
  // NULL quando il cambiamento lo registra la segreteria: lì non c'è nessun testo
  // mostrato a schermo da versionare, c'è una persona che riferisce.
  testoVersione: varchar('testo_versione', { length: 40 }),

  origine: consensoOrigineEnum('origine').notNull(),

  // CHI ha materialmente fatto il cambiamento: il genitore che ha toccato
  // l'interruttore nel portale, oppure l'operatore della segreteria che l'ha
  // registrato. È diverso da userId: la segreteria registra il consenso DI un
  // genitore, ma l'attore è l'operatore. Senza questo nome la riga sarebbe un
  // orario senza testimone. onDelete 'set null' per la stessa ragione di sopra.
  attoreUserId: text('attore_user_id').references(() => users.id, { onDelete: 'set null' }),

  // Il perché, a parole, quando serve ("autorizzazione firmata su carta,
  // consegnata in segreteria"). Facoltativo.
  note: text('note'),

  // Quando. Non c'è updatedAt apposta: una riga di questo registro non si aggiorna.
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Le due letture che facciamo davvero, entrambe "l'ultima riga di questo tipo":
  // per l'alunno (minore di 14 anni, immagini) e per la persona (marketing).
  // createdAt in coda all'indice perché l'ordinamento fa parte della domanda.
  studentTipoIdx: index('consensi_student_tipo_idx').on(t.studentId, t.tipo, t.createdAt),
  userTipoIdx:    index('consensi_user_tipo_idx').on(t.userId, t.tipo, t.createdAt),
}))
