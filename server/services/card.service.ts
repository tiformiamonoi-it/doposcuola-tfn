// La card studente vista dal server: legge pacchetti e lezioni e chiede la risposta
// alla regola unica in shared/card-studente.ts. Qui non si decide niente.
import { and, eq, inArray, lte, max } from 'drizzle-orm'
import { db } from '../database/client'
import { lessons, lessonStudents, packages, standardPackages, studentParents, students, users } from '../database/schema'
import { nonTrovato } from '../utils/http-error'
import { oggiRomeStr, romeDateStr } from '../utils/tutor-time-window'
import { getLinkedStudentIds } from '../utils/portal'
import { calcolaStatoCard, calcolaStatoCardGenitore, eNomeProBono, generaCodiceCard, type MotivoDisattivazioneCard, type PacchettoPerCard, type StatoCard } from '#shared/card-studente'

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
      nome:           packages.nome,
      nomeStandard:   standardPackages.nome,
    }).from(packages)
      .leftJoin(standardPackages, eq(standardPackages.id, packages.standardPackageId))
      .where(inArray(packages.studentId, studentIds)),
    // L'ULTIMA LEZIONE SVOLTA di ogni pacchetto: la più recente tra quelle che hanno
    // scalato ore da lui (lesson_students.package_id), fino a oggi compreso. Una lezione
    // già inserita per un giorno futuro non è ancora "svolta" e non sposta la data.
    db.select({ packageId: lessonStudents.packageId, ultima: max(lessons.data) })
      .from(lessonStudents)
      .innerJoin(lessons, eq(lessons.id, lessonStudents.lessonId))
      .where(and(inArray(lessonStudents.studentId, studentIds), lte(lessons.data, oggi)))
      .groupBy(lessonStudents.packageId),
    // Alunno archiviato (active = false) o card disattivata a mano → card sempre spenta, vedi calcolaStatoCard
    db.select({ id: students.id, active: students.active, disattivata: students.cardDisattivataMotivo })
      .from(students).where(inArray(students.id, studentIds)),
  ])

  const archiviati = new Set(anagrafiche.filter((s) => !s.active).map((s) => s.id))
  const disattivate = new Set(anagrafiche.filter((s) => s.disattivata).map((s) => s.id))
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
      proBono:        eNomeProBono(p.nome) || eNomeProBono(p.nomeStandard),
    })
  }
  for (const [id, lista] of perAlunno) esito.set(id, calcolaStatoCard(lista, oggi, archiviati.has(id), disattivate.has(id)))
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

// La card del GENITORE nel portale: solo la sua, mai quella dell'altro genitore (si legge
// per id della sessione). Stessa forma delle card dei figli, così la pagina la mette in
// testa all'elenco. Lo stato viene dai figli (calcolaStatoCardGenitore), senza motivo e
// senza "in margine": il perché lo racconta la card di ciascun figlio.
export async function getCardGenitore(userId: string) {
  const [[g], figli] = await Promise.all([
    db.select({ firstName: users.firstName, lastName: users.lastName, codiceCard: users.codiceCard })
      .from(users).where(and(eq(users.id, userId), eq(users.role, 'GENITORE'))).limit(1),
    getLinkedStudentIds(userId),
  ])
  if (!g?.codiceCard) return null
  const stato = calcolaStatoCardGenitore([...(await statoCardStudenti(figli)).values()])
  return {
    tipo: 'GENITORE' as const, id: userId, firstName: g.firstName, lastName: g.lastName,
    classe: null, scuola: null, codiceCard: g.codiceCard, ...stato, inMargine: false, motivo: null,
  }
}

// La card del TUTOR nell'area tutor (deciso il 16/11/2026): solo la sua, per id della
// sessione. Accesa finché l'account è attivo, senza data di scadenza: archiviando il
// tutor si spegne. Null per chi non è TUTOR o non ha ancora un codice.
export async function getCardTutor(userId: string) {
  const [t] = await db.select({ firstName: users.firstName, lastName: users.lastName, codiceCard: users.codiceCard, active: users.active })
    .from(users).where(and(eq(users.id, userId), eq(users.role, 'TUTOR'))).limit(1)
  if (!t?.codiceCard) return null
  return {
    tipo: 'TUTOR' as const, id: userId, firstName: t.firstName, lastName: t.lastName,
    codiceCard: t.codiceCard, attiva: t.active, validaFino: null, inMargine: false, motivo: null,
  }
}

// Verifica del negozio. Risponde SOLO se la card esiste ED è attiva: codice inesistente
// e card sospesa danno lo stesso null, così da fuori non si capisce se un codice esiste.
// Escono il nome e l'iniziale del cognome, nient'altro (regolamento, art. 6.1), più se è
// la card di uno studente, di un genitore o di un tutor.
//
// TEMPI UGUALI qualunque sia l'esito: si cerca SEMPRE in tutte e due le tabelle insieme,
// e lo stato si calcola SEMPRE, anche per un codice inesistente (su un id che non c'è).
// Altrimenti la risposta più rapida direbbe "codice mai dato", quella più lenta "codice di
// qualcuno, card sospesa", e la differenza tra alunno, genitore e tutor si sentirebbe nei tempi.
// Il genitore porta con sé i figli (una riga per figlio) nella stessa lettura; il tutor
// passa dalla stessa lettura (senza figli) e anche per lui lo stato si calcola, a vuoto.
export async function verificaCard(codice: string) {
  const [[s], righeUtente] = await Promise.all([
    db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
      .from(students).where(eq(students.codiceCard, codice)).limit(1),
    // Solo un account GENITORE o TUTOR attivo: un account disattivato, archiviato o
    // anonimizzato non ha card. SUPER_TUTOR e ADMIN non hanno card.
    db.select({ firstName: users.firstName, lastName: users.lastName, role: users.role, figlioId: studentParents.studentId })
      .from(users)
      .leftJoin(studentParents, eq(studentParents.parentUserId, users.id))
      .where(and(eq(users.codiceCard, codice), inArray(users.role, ['GENITORE', 'TUTOR']), eq(users.active, true))),
  ])
  const g = righeUtente[0]
  const figli = righeUtente.flatMap((r) => r.figlioId ? [r.figlioId] : [])
  const ids = s ? [s.id] : figli.length > 0 ? figli : ['']
  const stati = await statoCardStudenti(ids)

  const chi = s ?? g
  const tutor = !s && g?.role === 'TUTOR'
  // Il tutor: card accesa finché l'account è attivo (già filtrato sopra), senza scadenza
  const stato = s ? stati.get(s.id)! : tutor ? { attiva: true, validaFino: null } : calcolaStatoCardGenitore(figli.map((id) => stati.get(id)!))
  if (!chi || !stato.attiva) return null
  return {
    tipo: s ? 'STUDENTE' as const : tutor ? 'TUTOR' as const : 'GENITORE' as const,
    nome: chi.firstName, inizialeCognome: chi.lastName.charAt(0).toUpperCase(), validaFino: stato.validaFino,
  }
}

// Un codice che non hanno né un alunno né un utente (genitore o tutor): la pagina del
// negozio cerca in tutte e due le tabelle, e uno stesso codice porterebbe a due persone.
// I vincoli unici del database valgono una tabella per volta, quindi il controllo
// incrociato sta qui. Lo usano la creazione dell'alunno (createStudent), quella del
// genitore e del tutor, e i "Cambia codice". Il $defaultFn di schema/students.ts resta solo come rete di sicurezza per chi
// inserisce un alunno senza passare da qui (l'import dal vecchio gestionale): quello non
// guarda i genitori, ma con mille card una collisione capita 1 volta su ~10^9.
export async function codiceCardLibero(): Promise<string> {
  for (;;) {
    const codice = generaCodiceCard()
    const [alunni, genitori] = await Promise.all([
      db.select({ id: students.id }).from(students).where(eq(students.codiceCard, codice)).limit(1),
      db.select({ id: users.id }).from(users).where(eq(users.codiceCard, codice)).limit(1),
    ])
    if (alunni.length === 0 && genitori.length === 0) return codice
  }
}

// "Cambia codice" (card persa o girata ad altri): il vecchio smette di valere nello
// stesso istante, perché la verifica cerca solo il codice scritto qui.
export async function cambiaCodiceCard(studentId: string) {
  const [aggiornato] = await db.update(students)
    .set({ codiceCard: await codiceCardLibero(), updatedAt: new Date() })
    .where(eq(students.id, studentId))
    .returning({ codiceCard: students.codiceCard })
  if (!aggiornato) throw nonTrovato('Studente non trovato')
  return aggiornato
}

// "Cambia codice" della card del GENITORE, dalla scheda dell'alunno in segreteria
// (Credenziali Portale Famiglie). Solo su un account GENITORE.
// Con ruolo 'TUTOR' è quello della card del tutor, dalla sua scheda in segreteria: solo su
// un account TUTOR. A un tutor che il codice non l'ha (era SUPER_TUTOR) ne dà uno nuovo.
export async function cambiaCodiceCardGenitore(userId: string, ruolo: 'GENITORE' | 'TUTOR' = 'GENITORE') {
  const [aggiornato] = await db.update(users)
    .set({ codiceCard: await codiceCardLibero(), updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.role, ruolo)))
    .returning({ codiceCard: users.codiceCard })
  if (!aggiornato) throw nonTrovato(ruolo === 'TUTOR' ? 'Tutor non trovato' : 'Genitore non trovato')
  return aggiornato
}

// "Disattiva card" / "Riattiva card" in segreteria (regolamento, art. 5.2). Il motivo è uno
// dei due ammessi (controllato dall'API); null = riattiva, e la card torna a seguire le
// regole di pacchetti e pagamenti. La data serve alla notifica "è stata disattivata".
export async function impostaCardDisattivata(studentId: string, motivo: MotivoDisattivazioneCard | null) {
  const [aggiornato] = await db.update(students)
    .set({ cardDisattivataMotivo: motivo, cardDisattivataAt: motivo ? new Date() : null, updatedAt: new Date() })
    .where(eq(students.id, studentId))
    .returning({ cardDisattivataMotivo: students.cardDisattivataMotivo, cardDisattivataAt: students.cardDisattivataAt })
  if (!aggiornato) throw nonTrovato('Studente non trovato')
  return aggiornato
}
