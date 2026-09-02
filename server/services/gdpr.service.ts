// Diritti GDPR dell'interessato:
// - anonymizeStudent      → art. 17 (cancellazione): svuota i dati identificativi ma
//   conserva pacchetti/pagamenti/contabilità (obbligo fiscale 10 anni, art. 2220 c.c.)
// - exportStudentData     → art. 15/20 (accesso/portabilità): dump JSON dei dati dello studente
// - anonymizeLostContacts → art. 5.1.e (limitazione della conservazione): pulizia
//   automatica dei contatti "Persi" da oltre 12 mesi, lanciata dal cron giornaliero
import { db } from '../database/client'
import { students, studentParents, studentNotes, bookings, users, packages, payments, packageRecharges, lessons, lessonStudents, contacts, contactInteractions } from '../database/schema'
import { and, eq, ne, inArray, isNull, lt, sql } from 'drizzle-orm'

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
      note: null, bisogniSpeciali: null,
      active: false,
      abilitatoPrenotazioneOnline: false,
      updatedAt: new Date(),
    }).where(eq(students.id, id))

    return {
      noteEliminate:            noteEliminate.length,
      prenotazioniAnonimizzate: prenotazioni.length,
      genitoriAnonimizzati,
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
