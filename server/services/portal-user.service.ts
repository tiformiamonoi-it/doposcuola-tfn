import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { users, students, studentParents } from '../database/schema'
import { annullaLinkAperti, inviaInvitoPassword, inviaInvitoPasswordAUtente, passwordSegnapostoHash } from '../utils/password-token'
import { riepilogoSeraleAttivoGlobalmente } from './note-digest.service'
import { eMinoreDi14 } from '#shared/eta'
import type { CreatePortalAccessInput } from '#shared/schemas/portal-user.schema'

// Violazione di un vincolo unico Postgres (23505). Con `constraint` si restringe
// a un vincolo specifico (es. l'indice unico su student_parents).
function isUniqueViolation(err: any, constraint?: string): boolean {
  const causa = err?.cause ?? err
  if (err?.code !== '23505' && causa?.code !== '23505') return false
  if (!constraint) return true
  const nome = err?.constraint_name ?? err?.constraint ?? causa?.constraint_name ?? causa?.constraint
  return typeof nome === 'string' && nome.includes(constraint)
}

// Elenco dei genitori con accesso al portale collegati a uno studente
// (più di uno: es. genitori separati, ognuno con il proprio login).
export async function getPortalAccess(studentId: string) {
  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
    columns: { id: true, abilitatoPrenotazioneOnline: true, riepilogoSeraleAttivo: true },
  })

  if (!student) {
    throw new Error('Studente non trovato')
  }

  const links = await db.query.studentParents.findMany({
    where: eq(studentParents.studentId, studentId),
    orderBy: [asc(studentParents.createdAt)],
    with: {
      parentUser: {
        columns: { id: true, email: true, firstName: true, lastName: true, active: true },
      },
    },
  })

  // Quanti alunni vede ciascun genitore nel portale, questo compreso. Serve alla
  // finestra "Correggi email": se la mamma ha due figli, la segreteria deve sapere
  // che l'email che sta correggendo è quella con cui entra per tutti e due.
  // Una sola query raggruppata per tutti i genitori dell'alunno, niente N+1.
  const idGenitori = links.map((link) => link.parentUser.id)
  const conteggi = idGenitori.length === 0 ? [] : await db
    .select({ parentUserId: studentParents.parentUserId, figli: sql<number>`count(*)::int` })
    .from(studentParents)
    .where(inArray(studentParents.parentUserId, idGenitori))
    .groupBy(studentParents.parentUserId)
  const figliPerGenitore = new Map(conteggi.map((c) => [c.parentUserId, Number(c.figli)]))

  const parents = links.map((link) => ({
    linkId:    link.id,
    relazione: link.relazione,
    id:        link.parentUser.id,
    email:     link.parentUser.email,
    firstName: link.parentUser.firstName,
    lastName:  link.parentUser.lastName,
    active:    link.parentUser.active,
    numeroFigli: figliPerGenitore.get(link.parentUser.id) ?? 1,
  }))

  // L'interruttore GENERALE del riepilogo serale viaggia insieme a quello del
  // singolo alunno, in una risposta sola: la scheda deve poter dire "questo
  // interruttore oggi non conta, l'invio è spento per tutti" senza fare una seconda
  // chiamata alle configurazioni. Due interruttori che sembrano contraddirsi sono
  // il modo più veloce per far credere alla segreteria di aver acceso qualcosa che
  // in realtà resta spento.
  const riepilogoSeraleGeneraleAttivo = await riepilogoSeraleAttivoGlobalmente()

  return {
    id:                          student.id,
    abilitatoPrenotazioneOnline: student.abilitatoPrenotazioneOnline,
    riepilogoSeraleAttivo:       student.riepilogoSeraleAttivo,
    riepilogoSeraleGeneraleAttivo,
    parents,
  }
}

// AGGIUNGE un genitore allo studente (non sostituisce quelli già collegati).
// Se l'email esiste già come GENITORE non ancora collegato a questo alunno, restituisce
// una richiesta di conferma senza fare nulla (force=false); con force=true crea solo il
// collegamento, senza cambiare la password dell'account esistente.
export async function createPortalAccount(input: CreatePortalAccessInput, force = false) {
  const studente = await db.query.students.findFirst({
    where: eq(students.id, input.studentId),
    columns: { id: true },
  })
  if (!studente) throw new Error('Studente non trovato')

  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  })

  if (existing) {
    if (existing.role !== 'GENITORE') {
      throw new Error('Questa email è usata da un account staff. Usa un\'altra email per il genitore.')
    }

    // Già collegato a QUESTO alunno: niente da fare (gli altri figli non c'entrano)
    const giaCollegato = await db.query.studentParents.findFirst({
      where: and(
        eq(studentParents.studentId, input.studentId),
        eq(studentParents.parentUserId, existing.id),
      ),
      columns: { id: true },
    })
    if (giaCollegato) {
      throw new Error('Questo genitore è già collegato a questo alunno.')
    }

    if (!force) {
      // Segnala al frontend che serve conferma — non fa nulla
      return {
        requiresConfirmation: true as const,
        existingUser: {
          id:        existing.id,
          email:     existing.email,
          firstName: existing.firstName,
          lastName:  existing.lastName,
        },
      }
    }

    // force=true: collega l'account esistente a questo alunno, PASSWORD INVARIATA
    try {
      await db.insert(studentParents).values({
        studentId:    input.studentId,
        parentUserId: existing.id,
        relazione:    input.relazione ?? null,
      })
    } catch (err: any) {
      // Rete di sicurezza sull'indice unico (studentId, parentUserId): due richieste in parallelo
      if (isUniqueViolation(err, 'student_parents')) throw new Error('Questo genitore è già collegato a questo alunno.')
      throw err
    }

    const { password: _pw, ...safeUser } = existing
    return { ok: true, user: safeUser, alreadyExisted: true as const }
  }

  // Nessuno conosce questa password, nemmeno la segreteria: l'account resta
  // inutilizzabile finché il genitore non usa il link e ne sceglie una sua.
  const hashedPassword = await passwordSegnapostoHash()

  let created
  try {
    created = await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({
        email:     input.email.toLowerCase(),
        password:  hashedPassword,
        firstName: input.firstName,
        lastName:  input.lastName,
        role:      'GENITORE',
        active:    true,
        // Recapito e data di nascita del genitore: per il secondo genitore questo
        // è l'unico posto dove possono stare (students ha una sola riga "genitore")
        phone:       input.phone ?? null,
        dataNascita: input.dataNascita ?? null,
        // Niente "password temporanea da cambiare": la password se la sceglie
        // direttamente il genitore dal link, quindi non c'è nulla da forzare dopo.
        mustChangePassword: false,
      }).returning()

      if (!user) throw new Error('Inserimento utente portale fallito')

      await tx.insert(studentParents).values({
        studentId:    input.studentId,
        parentUserId: user.id,
        relazione:    input.relazione ?? null,
      })

      const { password: _pw, ...safeUser } = user
      return { ok: true, user: safeUser, alreadyExisted: false as const }
    })
  } catch (err: any) {
    // Corsa fra due richieste con la stessa email: messaggio chiaro invece di un errore Postgres
    if (isUniqueViolation(err, 'student_parents')) throw new Error('Questo genitore è già collegato a questo alunno.')
    if (isUniqueViolation(err)) throw new Error('Questa email è già usata da un altro account.')
    throw err
  }

  // Dopo la transazione: invito a scegliere la password (non blocca mai la creazione)
  const invito = await inviaInvitoPassword(created.user)

  return { ...created, ...invito }
}

// Crea l'account personale dello STUDENTE (solo prenotazioni).
// Attivo di default; il consenso del genitore è registrato con data, ORA e OPERATORE.
//
// `registratoDaUserId` è chi della segreteria sta creando l'account in questo
// momento (arriva dalla sessione, non dal browser: nessuno può dichiarare di
// essere un altro). L'informativa privacy promette "data e ora" del consenso:
// senza il nome di chi l'ha raccolto quella riga non è dimostrabile a nessuno.
//
// L'AUTORIZZAZIONE DEL GENITORE NON SERVE SEMPRE (decisione Q16 del piano).
// Serve — ed è un blocco vero — solo per chi non ha ancora compiuto 14 anni
// (art. 2-quinquies D.Lgs 196/2003): da 14 in su decide il ragazzo, e pretendere
// la spunta anche per un sedicenne è chiedere una cosa che non c'entra.
// Se la data di nascita manca non chiediamo niente (Q17): "non lo so" non è "no",
// e far firmare per sicurezza è il modo sbagliato di risolvere un dato mancante.
export async function createStudentAccount(input: {
  studentId: string
  email: string
  firstName: string
  lastName: string
  /** La spunta "il genitore autorizza": obbligatoria solo sotto i 14 anni */
  consensoGenitore?: boolean
  registratoDaUserId?: string | null
}) {
  // L'età si legge dal database, non dal browser: la regola del minore di 14 anni
  // non può dipendere da quello che il browser dichiara di sapere.
  const studente = await db.query.students.findFirst({
    where: eq(students.id, input.studentId),
    columns: { id: true, dataNascita: true },
  })
  if (!studente) throw new Error('Studente non trovato')

  const consensoGenitore = input.consensoGenitore === true
  if (!consensoGenitore && eMinoreDi14(studente.dataNascita) === true) {
    throw new Error('Per un alunno di meno di 14 anni serve l\'autorizzazione del genitore.')
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  })
  if (existing) {
    throw new Error('Questa email è già usata da un altro account. Usa un\'email personale dello studente.')
  }

  // Come per il genitore: password casuale che non conosce nessuno
  const hashedPassword = await passwordSegnapostoHash()

  const created = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email:     input.email.toLowerCase(),
      password:  hashedPassword,
      firstName: input.firstName,
      lastName:  input.lastName,
      role:      'STUDENTE',
      active:    true,
      mustChangePassword: false, // la password se la sceglie lo studente dal link
      // Data, ora e operatore SOLO se il genitore ha autorizzato davvero.
      // Scriverli comunque significherebbe lasciare in archivio la prova di un
      // consenso che nessuno ha dato: peggio che non averla.
      consensoGenitoreAt: consensoGenitore ? new Date() : null,
      // …e chi della segreteria era davanti al genitore quando l'ha detto.
      consensoGenitoreRegistratoDaUserId: consensoGenitore ? (input.registratoDaUserId ?? null) : null,
    }).returning()

    if (!user) throw new Error('Creazione account studente fallita')

    await tx.update(students)
      .set({ studentUserId: user.id, updatedAt: new Date() })
      .where(eq(students.id, input.studentId))

    const { password: _pw, ...safeUser } = user
    return { ok: true as const, user: safeUser }
  })

  const invito = await inviaInvitoPassword(created.user)

  return { ...created, ...invito }
}

// Scollega UN genitore da UNO studente (es. account creato con email sbagliata,
// oppure genitore che non deve più avere accesso).
// Se dopo lo scollegamento quel genitore non ha più nessun altro figlio collegato,
// l'account viene eliminato del tutto (come faceva la vecchia deletePortalAccount);
// se ha ancora altri figli resta attivo e gli altri collegamenti non si toccano.
// Se il genitore ha prenotazioni o altri dati collegati, il DB blocca la cancellazione:
// giusto così — lo storico non si elimina, si può solo disattivare l'account.
export async function unlinkParent(studentId: string, parentUserId: string) {
  try {
    return await db.transaction(async (tx) => {
      const [link] = await tx.delete(studentParents)
        .where(and(
          eq(studentParents.studentId, studentId),
          eq(studentParents.parentUserId, parentUserId),
        ))
        .returning({ id: studentParents.id })

      if (!link) throw new Error('Collegamento genitore non trovato')

      // Restano altri figli collegati a questo genitore? Se sì l'account non si tocca.
      const altroFiglio = await tx.query.studentParents.findFirst({
        where: eq(studentParents.parentUserId, parentUserId),
        columns: { id: true },
      })
      if (altroFiglio) {
        return { ok: true, scollegato: true as const, accountEliminato: false }
      }

      const deleted = await tx.delete(users)
        .where(and(eq(users.id, parentUserId), eq(users.role, 'GENITORE')))
        .returning({ id: users.id })
      if (deleted.length === 0) throw new Error('Account portale non trovato')

      return { ok: true, scollegato: true as const, accountEliminato: true }
    })
  } catch (err: any) {
    if (err?.code === '23503' || err?.cause?.code === '23503') {
      throw new Error('Il genitore ha prenotazioni o altri dati collegati: non si può eliminare l\'account.')
    }
    throw err
  }
}

// Attiva/disattiva l'account studente (users.active): disattivo = niente login né prenotazioni
export async function setStudentAccountActive(userId: string, active: boolean) {
  const [updated] = await db.update(users)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.role, 'STUDENTE')))
    .returning()
  if (!updated) throw new Error('Account studente non trovato')
  return { ok: true, active: updated.active }
}

// Manda a un genitore/studente già registrato un nuovo link "scegli la tua password".
// (Prima si chiamava resetPortalPassword e cambiava d'ufficio la password: vedi
// il commento su inviaInvitoPasswordAUtente per il perché non lo fa più.)
//
// Restituisce anche motivoEmail/dettaglioEmail quando la posta non parte: sono
// gli stessi campi che createPortalAccount e createStudentAccount portano su con
// lo spread di `invito`, così l'interfaccia dice sempre il motivo vero.
export async function inviaLinkPassword(userId: string) {
  return await inviaInvitoPasswordAUtente(userId)
}

// CORREGGE L'EMAIL CON CUI SI ENTRA (account STUDENTE o GENITORE di un alunno).
//
// L'email di una persona sta in due posti: sull'account (è il nome utente, e
// l'indirizzo a cui partono i link "scegli la tua password") e sulla scheda
// dell'alunno. Correggerne uno solo è la trappola: la scheda mostra l'indirizzo
// giusto, ma i link continuano ad andare a quello sbagliato. Qui si correggono
// insieme, in una transazione sola: o cambia tutto, o non cambia niente.
//
// In più si ANNULLANO i link ancora aperti — anche quando non se ne manda uno
// nuovo: erano partiti verso il vecchio indirizzo, e se quell'indirizzo era di
// un'altra persona, lei ha in mano un biglietto per entrare. Da qui in poi è scaduto.
//
// La password attuale NON si tocca (stessa scelta di inviaInvitoPasswordAUtente):
// chi l'aveva già scelta entra con la nuova email e la password di sempre.
export async function correggiEmailAccount(input: {
  studentId: string
  userId: string
  nuovaEmail: string
  inviaLink: boolean
}) {
  // Stessa forma con cui si salvano e si cercano le email al login: minuscole, senza spazi
  const nuovaEmail = input.nuovaEmail.trim().toLowerCase()
  if (!nuovaEmail) throw new Error('Scrivi la nuova email.')

  let esito: { vecchiaEmail: string; schedeAllineate: number }
  try {
    esito = await db.transaction(async (tx) => {
      // Riga dell'account bloccata fino alla fine: se due persone correggono la
      // stessa email nello stesso istante, la seconda aspetta e rilegge il valore
      // già corretto, invece di allineare le schede partendo da un'email vecchia.
      const [account] = await tx
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, input.userId))
        .for('update')
      if (!account) throw new Error('Account non trovato')

      // Da qui si correggono solo gli accessi delle famiglie. L'email dello staff
      // si cambia dalla scheda del tutor, dove c'è chi ha il diritto di farlo.
      if (account.role !== 'STUDENTE' && account.role !== 'GENITORE') {
        throw new Error('Questo è un account dello staff: la sua email si cambia dalla scheda del tutor.')
      }

      // L'account deve appartenere proprio a QUESTO alunno: la scheda da cui parte
      // la richiesta è anche quella che viene allineata.
      let idFigli: string[] = []
      if (account.role === 'STUDENTE') {
        const suo = await tx.query.students.findFirst({
          where: and(eq(students.id, input.studentId), eq(students.studentUserId, account.id)),
          columns: { id: true },
        })
        if (!suo) throw new Error('Questo account non è collegato a questo alunno.')
      } else {
        // Tutti i figli che questo genitore vede nel portale: servono subito per il
        // controllo, e dopo per allineare l'email su tutte le loro schede.
        const figli = await tx
          .select({ id: studentParents.studentId })
          .from(studentParents)
          .where(eq(studentParents.parentUserId, account.id))
        idFigli = figli.map((f) => f.id)
        if (!idFigli.includes(input.studentId)) throw new Error('Questo account non è collegato a questo alunno.')
      }

      // Confronto con il valore salvato così com'è: se l'account aveva un'email con
      // qualche maiuscola, riscriverla in minuscolo non è "la stessa" — è proprio
      // la correzione che le permette di entrare (il login cerca in minuscolo).
      if (account.email === nuovaEmail) throw new Error('È già questa l\'email di accesso.')

      const altro = await tx.query.users.findFirst({
        where: and(eq(users.email, nuovaEmail), ne(users.id, account.id)),
        columns: { id: true },
      })
      if (altro) throw new Error('Questa email è già usata da un altro account.')

      const adesso = new Date()

      await tx.update(users)
        .set({ email: nuovaEmail, updatedAt: adesso })
        .where(eq(users.id, account.id))

      // Il biglietto partito verso il vecchio indirizzo non vale più
      await annullaLinkAperti(account.id, tx)

      // Allineamento dell'anagrafica: una correzione sola, mai due versioni che si contraddicono
      let schedeAllineate = 0
      if (account.role === 'STUDENTE') {
        const righe = await tx.update(students)
          .set({ studentEmail: nuovaEmail, updatedAt: adesso })
          .where(and(
            eq(students.id, input.studentId),
            eq(students.studentUserId, account.id),
            // Solo se è davvero diversa: così il conteggio dice cosa è cambiato
            sql`${students.studentEmail} IS DISTINCT FROM ${nuovaEmail}`,
          ))
          .returning({ id: students.id })
        schedeAllineate = righe.length
      } else {
        // Il genitore può avere più figli: la vecchia email si corregge su TUTTE le
        // loro schede, sia come primo sia come secondo genitore. Senza chiedere:
        // è lo stesso account, e un indirizzo sbagliato è sbagliato ovunque.
        // Gli alunni NON collegati a questo account non si toccano, nemmeno se per
        // caso riportano la stessa email: lì non sappiamo di chi sia.
        const vecchia = account.email.trim().toLowerCase()
        const primo = await tx.update(students)
          .set({ parentEmail: nuovaEmail, updatedAt: adesso })
          .where(and(
            inArray(students.id, idFigli),
            sql`lower(trim(${students.parentEmail})) = ${vecchia}`,
          ))
          .returning({ id: students.id })
        const secondo = await tx.update(students)
          .set({ parent2Email: nuovaEmail, updatedAt: adesso })
          .where(and(
            inArray(students.id, idFigli),
            sql`lower(trim(${students.parent2Email})) = ${vecchia}`,
          ))
          .returning({ id: students.id })
        // Una scheda con la stessa email su tutti e due i genitori conta una volta
        schedeAllineate = new Set([...primo, ...secondo].map((r) => r.id)).size
      }

      return { vecchiaEmail: account.email, schedeAllineate }
    })
  } catch (err: any) {
    // Rete di sicurezza sull'indice unico di users.email: un'altra richiesta ha
    // preso la stessa email tra il controllo e la scrittura.
    if (isUniqueViolation(err)) throw new Error('Questa email è già usata da un altro account.')
    throw err
  }

  const risultato = {
    ok: true as const,
    email: nuovaEmail,
    vecchiaEmail: esito.vecchiaEmail,
    schedeAllineate: esito.schedeAllineate,
  }

  if (!input.inviaLink) return risultato

  // Dopo la transazione, come per gli account nuovi: il link parte verso la NUOVA
  // email (l'account ormai ha quella). motivoEmail/dettaglioEmail ci sono solo
  // quando la posta non è partita, per dire alla segreteria il perché vero.
  const invito = await inviaInvitoPasswordAUtente(input.userId)
  return {
    ...risultato,
    linkPassword:   invito.linkPassword,
    emailInviata:   invito.emailInviata,
    motivoEmail:    invito.motivoEmail,
    dettaglioEmail: invito.dettaglioEmail,
  }
}

// Aggiorna il flag abilitatoPrenotazioneOnline
export async function updatePrenotazioneFlag(studentId: string, abilitato: boolean) {
  const [updated] = await db.update(students)
    .set({ abilitatoPrenotazioneOnline: abilitato, updatedAt: new Date() } as any)
    .where(eq(students.id, studentId))
    .returning()
  return updated
}

// Aggiorna il flag riepilogoSeraleAttivo: l'email serale "c'è una comunicazione
// nuova nel portale" per QUESTA famiglia. Spegnerlo non nasconde niente: le
// comunicazioni restano visibili nel portale, smette solo di partire la posta.
export async function updateRiepilogoSeraleFlag(studentId: string, attivo: boolean) {
  const [updated] = await db.update(students)
    .set({ riepilogoSeraleAttivo: attivo, updatedAt: new Date() } as any)
    .where(eq(students.id, studentId))
    .returning()
  return updated
}
