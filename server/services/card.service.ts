// La card studente vista dal server: legge pacchetti e lezioni e chiede la risposta
// alla regola unica in shared/card-studente.ts. Qui non si decide niente.
import { and, eq, inArray, lte, max } from 'drizzle-orm'
import { db } from '../database/client'
import { lessons, lessonStudents, packages, students } from '../database/schema'
import { nonTrovato } from '../utils/http-error'
import { oggiRomeStr, romeDateStr } from '../utils/tutor-time-window'
import { calcolaStatoCard, generaCodiceCard, type PacchettoPerCard, type StatoCard } from '#shared/card-studente'

// Stato della card di più alunni in quattro letture, qualunque sia il loro numero.
// Si leggono TUTTI i pacchetti, anche chiusi e vecchi: un mensile saldato e appena
// scaduto tiene ancora accesa la card per 15 giorni, e un debito di mesi fa frena ancora.
// `senzaPacchetto`: la stessa domanda "come se quel pacchetto non ci fosse". Serve alla
// postilla delle email 5 e 6 per capire se è PROPRIO quel pacchetto a tenere accesa la
// card (vedi cardTenutaDaPacchetto qui sotto), senza riscrivere la regola.
export async function statoCardStudenti(studentIds: string[], senzaPacchetto?: string): Promise<Map<string, StatoCard>> {
  const esito = new Map<string, StatoCard>()
  if (studentIds.length === 0) return esito
  const oggi = oggiRomeStr()

  const [righe, ultime, anagrafiche] = await Promise.all([
    db.select({
      id:             packages.id,
      studentId:      packages.studentId,
      tipo:           packages.tipo,
      dataScadenza:   packages.dataScadenza,
      oreResiduo:     packages.oreResiduo,
      importoPagato:  packages.importoPagato,
      importoResiduo: packages.importoResiduo,
    }).from(packages).where(inArray(packages.studentId, studentIds)),
    // L'ULTIMA LEZIONE SVOLTA di ogni pacchetto: la più recente tra quelle che hanno
    // scalato ore da lui (lesson_students.package_id), fino a oggi compreso. Una lezione
    // già inserita per un giorno futuro non è ancora "svolta" e non sposta la data.
    db.select({ packageId: lessonStudents.packageId, ultima: max(lessons.data) })
      .from(lessonStudents)
      .innerJoin(lessons, eq(lessons.id, lessonStudents.lessonId))
      .where(and(inArray(lessonStudents.studentId, studentIds), lte(lessons.data, oggi)))
      .groupBy(lessonStudents.packageId),
    // Alunno archiviato (active = false) → card sempre spenta, vedi calcolaStatoCard
    db.select({ id: students.id, active: students.active }).from(students).where(inArray(students.id, studentIds)),
  ])

  const archiviati = new Set(anagrafiche.filter((s) => !s.active).map((s) => s.id))
  const ultimaPer = new Map(ultime.map((u) => [u.packageId, u.ultima]))
  const perAlunno = new Map<string, PacchettoPerCard[]>(studentIds.map((id) => [id, []]))
  for (const p of righe) {
    if (p.id === senzaPacchetto) continue
    perAlunno.get(p.studentId)?.push({
      tipo:           p.tipo,
      // Giorno civile italiano, come fa la macchina a stati dei pacchetti (package.service.ts)
      dataScadenza:   p.dataScadenza ? romeDateStr(new Date(p.dataScadenza)) : null,
      oreResiduo:     p.oreResiduo,
      importoPagato:  p.importoPagato,
      importoResiduo: p.importoResiduo,
      ultimaLezione:  ultimaPer.get(p.id) ?? null,
    })
  }
  for (const [id, lista] of perAlunno) esito.set(id, calcolaStatoCard(lista, oggi, archiviati.has(id)))
  return esito
}

// LA POSTILLA DELLE EMAIL 5 E 6: "la card resta attiva fino al …, se il pacchetto non viene
// rinnovato si disattiverà". Ha senso solo se è proprio QUEL pacchetto a tenerla accesa.
// Come lo si capisce senza riscrivere la regola: si chiede la card due volte, con e senza
// quel pacchetto. Il pacchetto la tiene accesa se, senza di lui, la card finirebbe PRIMA
// (o non sarebbe accesa affatto). Se invece un altro pacchetto la porta altrettanto
// lontano o più in là, o se la data viene dal freno di un debito più vecchio, togliendolo
// non cambia niente (o la data si allunga): niente postilla, perché rinnovarlo non la salva.
// Restituisce il giorno civile da scrivere, oppure null = niente postilla.
export async function cardTenutaDaPacchetto(studentId: string, packageId: string): Promise<string | null> {
  const [con, senza] = await Promise.all([statoCardStudenti([studentId]), statoCardStudenti([studentId], packageId)])
  const stato = con.get(studentId)!
  if (!stato.attiva || !stato.validaFino) return null
  const altro = senza.get(studentId)!
  // Senza di lui resta accesa "senza fine" (validaFino null) o fino a una data uguale o più lontana
  const copertaDaAltri = altro.attiva && (altro.validaFino === null || altro.validaFino >= stato.validaFino)
  return copertaDaAltri ? null : stato.validaFino
}

// Le card dei figli (o dello studente stesso) per il portale.
// PRIVACY ECONOMICA: lo STUDENTE non riceve il motivo. "Da saldare" racconta i soldi
// della famiglia, e anche "scaduto" lo fa capire: all'alunno basta "chiedi in segreteria".
// Il campo non esce proprio dal server, così non si legge nemmeno dagli strumenti del browser.
export async function getPortalCards(studentIds: string[], perStudente: boolean) {
  if (studentIds.length === 0) return []
  const [anagrafiche, stati] = await Promise.all([
    db.select({
      id:         students.id,
      firstName:  students.firstName,
      lastName:   students.lastName,
      classe:     students.classe,
      scuola:     students.scuola,
      codiceCard: students.codiceCard,
    }).from(students).where(inArray(students.id, studentIds)),
    statoCardStudenti(studentIds),
  ])
  return anagrafiche.map((s) => {
    const { motivo, ...stato } = stati.get(s.id)!
    return perStudente ? { ...s, ...stato } : { ...s, ...stato, motivo }
  })
}

// Verifica del negozio. Risponde SOLO se la card esiste ED è attiva: codice inesistente
// e card sospesa danno lo stesso null, così da fuori non si capisce se un codice esiste.
// Escono il nome e l'iniziale del cognome, nient'altro (regolamento, art. 6.1).
export async function verificaCard(codice: string) {
  const [s] = await db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
    .from(students).where(eq(students.codiceCard, codice)).limit(1)
  if (!s) return null
  const stato = (await statoCardStudenti([s.id])).get(s.id)!
  if (!stato.attiva) return null
  return { nome: s.firstName, inizialeCognome: s.lastName.charAt(0).toUpperCase(), validaFino: stato.validaFino }
}

// "Cambia codice" (card persa o girata ad altri): il vecchio smette di valere nello
// stesso istante, perché la verifica cerca solo il codice scritto qui.
// ponytail: nessun nuovo tentativo se il codice estratto esiste già (1 su ~10^9 con
// mille alunni): la scrittura fallisce sul vincolo unico e basta ripremere il tasto.
export async function cambiaCodiceCard(studentId: string) {
  const [aggiornato] = await db.update(students)
    .set({ codiceCard: generaCodiceCard(), updatedAt: new Date() })
    .where(eq(students.id, studentId))
    .returning({ codiceCard: students.codiceCard })
  if (!aggiornato) throw nonTrovato('Studente non trovato')
  return aggiornato
}
