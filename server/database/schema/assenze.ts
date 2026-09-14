import { pgTable, text, varchar, boolean, date, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { cuid, assenzaOrigineEnum } from './common'
import { users } from './users'
import { students } from './students'

// LE ASSENZE SEGNALATE — la prenotazione al contrario (voce G1 del piano).
//
// PERCHÉ ESISTE QUESTA TABELLA.
// Alle superiori la famiglia dice QUANDO viene (è la prenotazione: se non
// prenoti, non hai il posto). Alle medie il modello è girato: i ragazzi vengono
// tutti i giorni e le materie sono già coperte, quindi l'unica cosa che la
// segreteria non sa è QUANDO NON vengono. È la mensa scolastica: il posto ce
// l'hai sempre, semmai avvisi che oggi non mangi.
//
// PERCHÉ NON UNO STATO DELLA PRENOTAZIONE (che sarebbe stato più corto).
// Una prenotazione "annullata" è una cosa diversa da un'assenza: la prima dice
// «quel posto che avevo chiesto liberalo», la seconda dice «il posto che ho
// sempre oggi non lo uso». Soprattutto, per le medie la prenotazione NON C'È:
// non si può annullare qualcosa che non è mai stato scritto da nessuna parte.
//
// QUESTA TABELLA NON TOCCA I SOLDI. Nessuna colonna qui dentro scala ore,
// giorni o importi da un pacchetto — vedi il commento grande in
// assenze.service.ts, che è il posto dove qualcuno un domani proverà a
// "sistemare" la cosa. È la decisione Q12 e ha una ragione pratica: se avvisare
// costasse un giorno di pacchetto, le famiglie smetterebbero di avvisare, e
// resteremmo senza l'informazione per cui la funzione è nata.
export const assenze = pgTable('assenze', {
  id: text('id').primaryKey().$defaultFn(cuid),

  // L'alunno che non viene. onDelete 'cascade': se l'alunno sparisce davvero dal
  // database, le sue assenze non hanno più nessun significato — a differenza dei
  // consensi, qui non c'è niente da dimostrare a nessuno.
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),

  // IL GIORNO in cui non viene, 'AAAA-MM-GG'. MAI timestamptz, come
  // students.dataNascita e closureDates.date: questo è un GIORNO, non un istante.
  // Con l'ora dentro, un'assenza salvata a mezzanotte scivolerebbe al giorno
  // prima o al giorno dopo a seconda del fuso, e la segreteria si troverebbe il
  // ragazzo assente nella casella sbagliata del calendario.
  data: date('data', { mode: 'string' }).notNull(),

  // «Ha la febbre», «visita dal dentista». Facoltativo sul serio: il piano dice
  // che avvisare non deve costare niente, nemmeno la fatica di spiegarsi.
  // 200 caratteri: è una riga da leggere di colpo la mattina, non un racconto.
  motivo: varchar('motivo', { length: 200 }),

  // CHI ha segnalato: il genitore (o il ragazzo) dal portale, oppure l'operatore
  // della segreteria che ha risposto al telefono. onDelete 'set null': se
  // quell'account un giorno sparisce, l'assenza resta — quello che conta è che
  // il ragazzo quel giorno non è venuto, non chi ce l'ha detto.
  segnalataDaUserId: text('segnalata_da_user_id').references(() => users.id, { onDelete: 'set null' }),

  origine: assenzaOrigineEnum('origine').notNull(),

  // Segnalata DOPO le 10 del mattino del giorno stesso (decisione Q22).
  // Non è un castigo e non blocca niente: l'assenza si registra comunque. Serve
  // a distinguere, guardando l'elenco, chi ha avvisato in tempo — quando il
  // calendario della giornata era ancora modificabile — da chi ha avvisato quando
  // ormai il tutor era già stato organizzato. Si scrive UNA VOLTA SOLA, al primo
  // inserimento: se la famiglia poi corregge il motivo alle 11, l'avviso resta
  // "in tempo", perché in tempo lo era davvero.
  oltreIlTermine: boolean('oltre_il_termine').notNull().default(false),

  // Quando è arrivata la segnalazione. Serve anche a schermo: la segreteria vuole
  // sapere se la mamma ha scritto alle 7:40 o alle 9:55.
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // LA STESSA ASSENZA NON SI SEGNALA DUE VOLTE. Il vincolo sta nel database e non
  // solo nel codice perché due tocchi sul bottone da telefono (o due genitori che
  // avvisano per lo stesso figlio) arrivano davvero insieme: qui il secondo
  // inserimento non crea una riga gemella, aggiorna quella che c'è.
  studentDataUq: uniqueIndex('assenze_student_data_uq').on(t.studentId, t.data),

  // La domanda della mattina è «chi manca OGGI?»: un indice sul solo giorno.
  // Non è ridondante con quello sopra: l'unico parte da studentId, e Postgres non
  // può usarlo per cercare per sola data.
  dataIdx: index('assenze_data_idx').on(t.data),
}))
