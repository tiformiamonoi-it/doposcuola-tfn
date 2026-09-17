// Diritti GDPR dell'interessato:
// - anonymizeStudent      → art. 17 (cancellazione): svuota i dati identificativi ma
//   conserva pacchetti/pagamenti/contabilità (obbligo fiscale 10 anni, art. 2220 c.c.).
//   Pulisce anche la sezione Contatti, da cui quasi ogni alunno proviene: senza
//   quel passaggio la stessa persona resterebbe in chiaro in un'altra pagina.
// - exportStudentData     → art. 15/20 (accesso/portabilità): dump JSON dei dati dello studente
// - anonymizeLostContacts → art. 5.1.e (limitazione della conservazione): pulizia
//   automatica dei contatti "Persi" da oltre 12 mesi, lanciata dal cron giornaliero
import { db } from '../database/client'
import { students, studentParents, studentNotes, bookings, users, packages, payments, packageRecharges, lessons, lessonStudents, contacts, contactInteractions, contactFigli } from '../database/schema'
import { and, eq, ne, inArray, isNull, lt, sql } from 'drizzle-orm'
import { INIZIO_NOTA_CONVERSIONE } from '#shared/contatti'

export async function anonymizeStudent(id: string) {
  const [student] = await db.select().from(students).where(eq(students.id, id)).limit(1)
  if (!student) throw new Error('Studente non trovato')

  return db.transaction(async (tx) => {
    // Note didattiche: eliminate (nessun obbligo di conservazione)
    const noteEliminate = await tx.delete(studentNotes)
      .where(eq(studentNotes.studentId, id))
      .returning({ id: studentNotes.id })

    // Prenotazioni: via i dati denormalizzati (nome, cognome, telefono, note libere)
    const prenotazioni = await tx.update(bookings)
      .set({ studentName: 'Studente', studentSurname: 'Anonimizzato', studentPhone: '', notes: null, updatedAt: new Date() })
      .where(eq(bookings.studentId, id))
      .returning({ id: bookings.id })

    // Account personale dello studente: disattivato e anonimizzato (email fittizia unica)
    if (student.studentUserId) {
      await tx.update(users).set({
        active:    false,
        email:     `anonimizzato-${student.studentUserId}@anonimo.invalid`,
        firstName: 'Studente',
        lastName:  'Anonimizzato',
        phone:     null,
        updatedAt: new Date(),
      }).where(eq(users.id, student.studentUserId))
    }

    // Account portale dei genitori collegati: ognuno viene anonimizzato solo se non
    // ha altri figli collegati (chi ne ha resta intatto, gli serve per gli altri figli).
    const collegamenti = await tx.select({ parentUserId: studentParents.parentUserId })
      .from(studentParents)
      .where(eq(studentParents.studentId, id))

    let genitoriAnonimizzati = 0
    for (const { parentUserId } of collegamenti) {
      const [altroFiglio] = await tx.select({ id: studentParents.id }).from(studentParents)
        .where(and(eq(studentParents.parentUserId, parentUserId), ne(studentParents.studentId, id)))
        .limit(1)
      if (altroFiglio) continue

      await tx.update(users).set({
        active:    false,
        email:     `anonimizzato-${parentUserId}@anonimo.invalid`,
        firstName: 'Genitore',
        lastName:  'Anonimizzato',
        phone:     null,
        updatedAt: new Date(),
      }).where(eq(users.id, parentUserId))
      genitoriAnonimizzati++
    }

    // Nessun genitore deve più vedere questo alunno nel portale
    await tx.delete(studentParents).where(eq(studentParents.studentId, id))

    // Anagrafica studente: svuotata. Pacchetti/pagamenti/contabilità NON si toccano
    // (conservazione obbligatoria per legge), ma non rimandano più a una persona identificabile.
    await tx.update(students).set({
      firstName: 'Studente',
      lastName:  'Anonimizzato',
      classe: null, scuola: null, studentPhone: null, studentEmail: null,
      parentName: null, parentEmail: null, parentPhone: null, parentIndirizzo: null,
      parentCitta: null, parentCap: null, parentCF: null, parentPIva: null,
      parentRelazione: null,
      // SECONDO GENITORE: si svuota esattamente come il primo. Dimenticarlo qui
      // vorrebbe dire lasciare nome, recapiti e codice fiscale di una persona nel
      // database DOPO una richiesta di cancellazione (art. 17): una violazione,
      // non una dimenticanza estetica. Ogni colonna parent2* aggiunta all'anagrafica
      // va aggiunta anche in questo elenco.
      parent2Name: null, parent2Email: null, parent2Phone: null, parent2Indirizzo: null,
      parent2Citta: null, parent2Cap: null, parent2CF: null, parent2PIva: null,
      parent2DataNascita: null, parent2Relazione: null,
      note: null, bisogniSpeciali: null,
      active: false,
      abilitatoPrenotazioneOnline: false,
      updatedAt: new Date(),
    }).where(eq(students.id, id))

    // ── LA SEZIONE CONTATTI (il punto che mancava) ──
    //
    // Quasi ogni alunno arriva da un contatto: la mamma che ha scritto su
    // Instagram, la telefonata di settembre. In quella scheda restano il suo
    // nome, il suo numero, la classe del figlio e il diario di che cosa ci si è
    // detti. Svuotare l'anagrafica dell'alunno e lasciare intatta quella scheda
    // vuol dire NON aver cancellato niente: la persona è ancora lì, con nome e
    // cognome, in un'altra pagina del gestionale.
    //
    // Qui si fa nella STESSA transazione del resto: o si cancella tutto, o non si
    // cancella niente. Una cancellazione a metà è la peggiore delle due.
    const adesso = new Date()

    // 1. I "figli" del contatto che puntano a questo alunno spariscono del tutto:
    //    sono nome, classe e scuola di un minore, e alle statistiche non servono
    //    (stessa scelta di anonymizeLostContacts).
    const figliEliminati = await tx.delete(contactFigli)
      .where(eq(contactFigli.studentId, id))
      .returning({ contactId: contactFigli.contactId })

    // 2. Il collegamento diretto contatto → alunno si stacca. La riga del contatto
    //    resta (serve ai conteggi "quanti si sono iscritti"), ma non rimanda più
    //    a una persona.
    const contattiScollegati = await tx.update(contacts)
      .set({ studentId: null, updatedAt: adesso })
      .where(eq(contacts.studentId, id))
      .returning({ id: contacts.id })

    // 3. I contatti toccati che ora sono RIMASTI SENZA NESSUN FIGLIO si
    //    anonimizzano come quelli persi da 12 mesi. Quelli che hanno ancora altri
    //    figli NON si toccano: lì i dati sono anche della famiglia che resta, e
    //    cancellarli toglierebbe alla sorella il diritto di essere ricontattata.
    const daControllare = new Set<string>([
      ...figliEliminati.map((f) => f.contactId),
      ...contattiScollegati.map((c) => c.id),
    ])

    // La riga di diario «Convertito in studente: Luca Rossi» porta il nome in chiaro.
    // Nei contatti che verranno anonimizzati qui sotto sparisce con tutte le altre
    // note; ma in quelli che restano (hanno un altro figlio) va tolto il nome
    // almeno lì. Resta il fatto, "un figlio è diventato alunno", che non identifica
    // nessuno. Il prefisso non cambia, così la riga continua a non contare come
    // conversazione (vedi eRigaDiConversione).
    if (daControllare.size > 0) {
      await tx.update(contactInteractions)
        .set({ note: `${INIZIO_NOTA_CONVERSIONE}studente: (alunno anonimizzato)` })
        .where(and(
          inArray(contactInteractions.contactId, [...daControllare]),
          eq(contactInteractions.note, `${INIZIO_NOTA_CONVERSIONE}studente: ${`${student.firstName} ${student.lastName}`.trim()}`),
        ))
    }

    let contattiAnonimizzati = 0
    for (const contactId of daControllare) {
      const [altroFiglio] = await tx.select({ id: contactFigli.id })
        .from(contactFigli)
        .where(eq(contactFigli.contactId, contactId))
        .limit(1)
      if (altroFiglio) continue

      // Il diario resta (serve alle statistiche) ma senza il testo di ciò che si
      // è detto: lì dentro ci sono spesso il nome del ragazzo e i suoi problemi.
      await tx.update(contactInteractions)
        .set({ note: null })
        .where(eq(contactInteractions.contactId, contactId))

      // Stesso trattamento di anonymizeLostContacts, campo per campo. Chi è già
      // stato anonimizzato non si ritocca (isNull): la sua data di pulizia è
      // quella vera, non quella di oggi.
      const puliti = await tx.update(contacts).set({
        nome:    'Contatto',
        cognome: 'anonimizzato',
        telefono: null, email: null, socialLink: null, note: null,
        nomeStudente: null, classeScuola: null, materie: null,
        azienda: null, servizioInteresse: null,
        archiviatoAt:   sql`COALESCE(${contacts.archiviatoAt}, now())`,
        anonimizzatoAt: adesso,
        updatedAt:      adesso,
      })
        .where(and(eq(contacts.id, contactId), isNull(contacts.anonimizzatoAt)))
        .returning({ id: contacts.id })

      contattiAnonimizzati += puliti.length
    }

    // LE RIGHE DI `consensi` NON SI TOCCANO, di proposito: sono la prova di che
    // cosa era stato acconsentito e quando, e da sole non contengono nomi né
    // recapiti — solo dei collegamenti a righe ormai svuotate.

    return {
      noteEliminate:            noteEliminate.length,
      prenotazioniAnonimizzate: prenotazioni.length,
      genitoriAnonimizzati,
      figliContattoEliminati:   figliEliminati.length,
      contattiAnonimizzati,
    }
  })
}

// Contatti "Persi" fermi da più di `mesi`: si cancellano i dati personali e si
// archiviano, ma le righe restano (contatti e diario) perché servono ai conteggi
// "quanti contatti persi", "da quale fonte". Nessuno può più risalire alla persona.
export async function anonymizeLostContacts(mesi = 12) {
  const limite = new Date()
  limite.setMonth(limite.getMonth() - mesi)

  return db.transaction(async (tx) => {
    const daPulire = await tx.select({ id: contacts.id })
      .from(contacts)
      .where(and(
        eq(contacts.stato, 'PERSO'),
        isNull(contacts.anonimizzatoAt),
        lt(contacts.updatedAt, limite),
      ))

    if (daPulire.length === 0) return 0

    const ids = daPulire.map((c) => c.id)
    const adesso = new Date()

    // Il diario resta (serve alle statistiche) ma senza il testo di ciò che si è detto
    await tx.update(contactInteractions)
      .set({ note: null })
      .where(inArray(contactInteractions.contactId, ids))

    // I figli della famiglia si cancellano del tutto: sono nomi, classi e scuole di
    // minori, e alle statistiche non servono. (I tre campi di prima sul contatto
    // si svuotano qui sotto, come sempre.)
    await tx.delete(contactFigli)
      .where(inArray(contactFigli.contactId, ids))

    await tx.update(contacts).set({
      nome:    'Contatto',
      cognome: 'anonimizzato',
      telefono: null, email: null, socialLink: null, note: null,
      nomeStudente: null, classeScuola: null, materie: null,
      azienda: null, servizioInteresse: null,
      // Se era ancora in lista, sparisce anche da lì (chi è già archiviato resta com'è)
      archiviatoAt:   sql`COALESCE(${contacts.archiviatoAt}, now())`,
      anonimizzatoAt: adesso,
      updatedAt:      adesso,
    }).where(inArray(contacts.id, ids))

    return ids.length
  })
}

export async function exportStudentData(id: string) {
  const [student] = await db.select().from(students).where(eq(students.id, id)).limit(1)
  if (!student) throw new Error('Studente non trovato')

  const [pacchetti, prenotazioni, noteFamiglia, lezioni] = await Promise.all([
    db.select().from(packages).where(eq(packages.studentId, id)),
    db.select().from(bookings).where(eq(bookings.studentId, id)),
    db.select().from(studentNotes)
      .where(and(eq(studentNotes.studentId, id), eq(studentNotes.visibilita, 'FAMIGLIA'))),
    db.select({ data: lessons.data, tipo: lessons.tipo, oreScalate: lessonStudents.oreScalate })
      .from(lessonStudents)
      .innerJoin(lessons, eq(lessonStudents.lessonId, lessons.id))
      .where(eq(lessonStudents.studentId, id)),
  ])

  const pkgIds = pacchetti.map((p) => p.id)
  const [pagamenti, ricariche] = pkgIds.length
    ? await Promise.all([
        db.select().from(payments).where(inArray(payments.packageId, pkgIds)),
        db.select().from(packageRecharges).where(inArray(packageRecharges.packageId, pkgIds)),
      ])
    : [[], []]

  return {
    esportatoIl:              new Date().toISOString(),
    studente:                 student,
    pacchetti,
    pagamenti,
    ricariche,
    prenotazioni,
    lezioni,
    noteVisibiliAllaFamiglia: noteFamiglia,
  }
}
