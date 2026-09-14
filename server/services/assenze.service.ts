// server/services/assenze.service.ts
//
// LE ASSENZE DELLE MEDIE — la prenotazione al contrario (voce G1 del piano).
//
// Alle superiori la famiglia dice quando VIENE: è la prenotazione, e senza
// prenotazione non c'è posto. Alle medie il modello è girato: i ragazzi vengono
// tutti i giorni e le materie sono già coperte, quindi l'unica cosa che manca
// alla segreteria è sapere quando NON vengono. È la mensa scolastica: il posto
// ce l'hai sempre, semmai avvisi che oggi non mangi.
//
// ⚠️ L'ASSENZA NON SCALA NIENTE. Non ore, non giorni, non importi, non pacchetti.
// In questo file non c'è, e non deve arrivarci, una sola riga che tocchi la
// tabella `packages`. È la decisione Q12, ed è la cosa che qualcuno un domani
// proverà a "sistemare" pensando di aver trovato una dimenticanza. Non lo è:
//   • i Termini (art. 5.3) dicono che scalare è una facoltà del Centro, non la prassi;
//   • soprattutto, se avvisare costasse un giorno di pacchetto le famiglie
//     smetterebbero di avvisare — e resteremmo senza l'informazione per cui
//     l'intera funzione è nata. Una funzione che si punisce da sola non serve.
// Se un giorno il Centro vorrà davvero scalare qualcosa, sarà una decisione presa
// a voce con la famiglia e registrata a mano sul pacchetto, non un automatismo.
//
// IL PREAVVISO (Q22): entro le 10 del mattino del giorno stesso. Dopo le 10
// l'assenza si registra COMUNQUE — non si perde mai un'informazione vera — ma
// resta marchiata come "fuori tempo", così la segreteria sa distinguere chi ha
// avvisato quando la giornata si poteva ancora riorganizzare. La soglia è scritta
// una volta sola in shared/assenze.ts, perché la legge anche il portale.

import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../database/client'
import { assenze, students } from '../database/schema'
import { creaNotifica } from './notifiche.service'
import { oggiRomeStr, oraRome } from '../utils/tutor-time-window'
import { giornoCivileValido } from '#shared/giorno-civile'
import { assenzaFuoriTempo, ORA_LIMITE_ASSENZA_TESTO } from '#shared/assenze'

export type AssenzaOrigine = 'PORTALE' | 'GESTIONALE'

/** Una riga già pronta da mostrare: nomi risolti, niente identificativi da decifrare */
export interface RigaAssenza {
  id: string
  studentId: string
  /** 'Luca Rossi' */
  nomeAlunno: string
  /** '2ª Media', oppure null se nella scheda non c'è scritto */
  classe: string | null
  /** Il giorno in cui non viene, 'AAAA-MM-GG' */
  data: string
  motivo: string | null
  origine: AssenzaOrigine
  /** Segnalata dopo le 10 del giorno stesso: è arrivata tardi */
  oltreIlTermine: boolean
  /** Quando è arrivata la segnalazione (istante, non giorno) */
  segnalataAt: Date
  /** Nome di chi l'ha segnalata, quando lo sappiamo */
  segnalataDa: string | null
}

// "Mario Rossi", oppure null se l'account non c'è più o non ha nome.
// Mai la stringa "null null" sotto gli occhi della segreteria.
const nomeDi = (u: { firstName: string | null; lastName: string | null } | null | undefined) =>
  u && (u.firstName || u.lastName) ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : null

// Un giorno civile spostato indietro (o avanti) di N giorni, 'AAAA-MM-GG'.
// I conti si fanno in UTC su una data SENZA ora, come giornoSuccessivo() in
// shared/giorno-civile.ts: sommare "24 ore" sbaglierebbe proprio nei due giorni
// del cambio dell'ora legale, che durano 23 e 25 ore.
function spostaGiorni(giorno: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(giorno)
  if (!m) return giorno
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta))
  return d.toISOString().slice(0, 10)
}

// La lettura di base: una join sola, i nomi già dentro. Le assenze di un giorno
// sono una manciata di righe, quelle di un alunno in un anno qualche decina: si
// leggono tutte e si ragiona in JavaScript, che si rilegge molto meglio dell'SQL.
async function leggi(dove: SQL | undefined, crescente = false) {
  const righe = await db.query.assenze.findMany({
    where: dove,
    orderBy: crescente ? [asc(assenze.data), asc(assenze.createdAt)] : [desc(assenze.data), desc(assenze.createdAt)],
    with: {
      student:     { columns: { firstName: true, lastName: true, classe: true } },
      segnalataDa: { columns: { firstName: true, lastName: true } },
    },
  })

  return righe.map((r): RigaAssenza => ({
    id:             r.id,
    studentId:      r.studentId,
    nomeAlunno:     `${r.student?.firstName ?? ''} ${r.student?.lastName ?? ''}`.trim(),
    classe:         r.student?.classe ?? null,
    data:           r.data,
    motivo:         r.motivo,
    origine:        r.origine as AssenzaOrigine,
    oltreIlTermine: r.oltreIlTermine,
    segnalataAt:    r.createdAt,
    segnalataDa:    nomeDi(r.segnalataDa),
  }))
}

// ─────────────────────────────────────────────
// SEGNALARE UN'ASSENZA
// ─────────────────────────────────────────────

export interface SegnalaAssenzaInput {
  studentId: string
  /** Il giorno in cui non viene, 'AAAA-MM-GG' */
  data: string
  /**
   * Il motivo, facoltativo. `undefined` = «non me ne sto occupando»: su
   * un'assenza già scritta il motivo di prima resta com'era. Una stringa vuota,
   * invece, è una scelta esplicita e cancella il motivo.
   */
  motivo?: string | null
  /** CHI sta segnalando: SEMPRE dalla sessione, mai dal browser */
  userId?: string | null
  origine: AssenzaOrigine
}

export interface EsitoSegnalazione {
  ok: true
  /** false quando l'assenza c'era già: non è un errore, è la stessa notizia ripetuta */
  creata: boolean
  id: string
  data: string
  /** true = è arrivata dopo le 10 del giorno stesso */
  oltreIlTermine: boolean
}

/**
 * La famiglia (o la segreteria, al telefono) avvisa che un alunno non verrà.
 *
 * Tre cose che vale la pena sapere prima di leggere il codice:
 *  • NON si può segnalare un giorno già passato. Un'assenza di ieri non è un
 *    avviso: è un racconto, e questa tabella serve a sapere le cose PRIMA.
 *  • Segnalare due volte lo stesso giorno NON è un errore. Succede davvero (due
 *    genitori che avvisano per lo stesso figlio, o un doppio tocco da telefono):
 *    la seconda volta aggiorna il motivo e basta, senza far comparire una schermata
 *    rossa a chi stava solo cercando di essere gentile.
 *  • L'etichetta "fuori tempo" si decide al PRIMO inserimento e non cambia più.
 *    Chi ha avvisato alle 7:40 e poi alle 11 ha aggiunto «ha la febbre» ha
 *    avvisato in tempo, punto.
 */
export async function segnalaAssenza(input: SegnalaAssenzaInput): Promise<EsitoSegnalazione> {
  const { studentId, origine } = input
  const data = (input.data ?? '').trim()

  // "2026-02-30" è ben formato ma non esiste: Postgres lo rifiuterebbe con un
  // errore tecnico illeggibile. Meglio fermarlo qui, con parole italiane.
  if (!giornoCivileValido(data)) {
    throw new Error('La data indicata non esiste sul calendario')
  }

  const oggi = oggiRomeStr()
  if (data < oggi) {
    throw new Error('Non si può segnalare un\'assenza per un giorno già passato')
  }

  // L'alunno deve esistere: serve il nome per l'avviso alla segreteria, e un
  // messaggio chiaro è meglio di un errore di chiave esterna del database.
  const alunno = await db.query.students.findFirst({
    where: eq(students.id, studentId),
    columns: { id: true, firstName: true, lastName: true },
  })
  if (!alunno) throw new Error('Alunno non trovato')

  // undefined = non toccare il motivo; '' = cancellalo; 'febbre' = scrivilo.
  const motivoNuovo = input.motivo === undefined
    ? undefined
    : (input.motivo?.trim() || null)

  const esistente = await db.query.assenze.findFirst({
    where: and(eq(assenze.studentId, studentId), eq(assenze.data, data)),
    columns: { id: true, motivo: true, oltreIlTermine: true },
  })

  if (esistente) {
    if (motivoNuovo !== undefined && motivoNuovo !== esistente.motivo) {
      await db.update(assenze).set({ motivo: motivoNuovo }).where(eq(assenze.id, esistente.id))
    }
    return { ok: true, creata: false, id: esistente.id, data, oltreIlTermine: esistente.oltreIlTermine }
  }

  const fuoriTempo = assenzaFuoriTempo(data, oggi, oraRome().ora)

  const [riga] = await db.insert(assenze).values({
    studentId,
    data,
    motivo:            motivoNuovo ?? null,
    segnalataDaUserId: input.userId ?? null,
    origine,
    oltreIlTermine:    fuoriTempo,
  })
    // La rete di sicurezza per il doppio tocco: fra la lettura di sopra e questo
    // inserimento può essersi infilata la stessa segnalazione partita due volte.
    // Non si scrive una riga gemella, si aggiorna il motivo — e NON si tocca
    // `oltre_il_termine`, che appartiene alla prima segnalazione.
    .onConflictDoUpdate({
      target: [assenze.studentId, assenze.data],
      set:    { motivo: motivoNuovo ?? null },
    })
    .returning({ id: assenze.id, oltreIlTermine: assenze.oltreIlTermine })

  const id = riga?.id ?? ''

  // L'AVVISO ALLA SEGRETERIA, solo per le assenze che arrivano DAL PORTALE e
  // FUORI TEMPO. Le altre si vedono già benissimo sul calendario del giorno, e
  // far suonare il campanellino quattro volte ogni mattina vorrebbe dire
  // insegnare a tutti a ignorarlo. Quella delle 11:30, invece, arriva quando
  // nessuno sta più guardando il calendario: è l'unica che ha bisogno di bussare.
  if (origine === 'PORTALE' && fuoriTempo) {
    try {
      await creaNotifica({
        tipo:      'GENERICA',
        titolo:    'Assenza segnalata in ritardo',
        messaggio: `${alunno.firstName} ${alunno.lastName}`.trim()
          + ` non verrà oggi. La famiglia l'ha scritto dopo le ${ORA_LIMITE_ASSENZA_TESTO}`
          + (motivoNuovo ? ` — «${motivoNuovo}»` : '')
          + '. Il calendario della giornata era già organizzato: conviene un controllo.',
        link:       `/calendario?data=${data}`,
        entityType: 'assenza',
        entityId:   id || null,
        // Ogni ritardo è una notizia a sé: accorparli nasconderebbe proprio il
        // secondo, che è quello che sorprende.
        evitaDoppioni: false,
      })
    } catch {
      // Volutamente silenzioso: l'assenza è già scritta, ed è lei che conta.
      // Un campanellino che non suona è un fastidio; un'assenza persa è un danno.
    }
  }

  return {
    ok: true,
    creata: true,
    id,
    data,
    oltreIlTermine: riga?.oltreIlTermine ?? fuoriTempo,
  }
}

// ─────────────────────────────────────────────
// ANNULLARE UN'ASSENZA ("alla fine viene")
// ─────────────────────────────────────────────

export interface AnnullaAssenzaOpzioni {
  /**
   * Gli alunni che chi sta annullando ha il diritto di toccare. Per il portale
   * sono i figli collegati; per la segreteria è `null` (nessun filtro).
   */
  studentIdsAmmessi?: string[] | null
  /**
   * true (portale): si può disdire solo finché il giorno non è passato. Un'assenza
   * di ieri è ormai un fatto avvenuto, e cancellarla riscriverebbe la storia.
   * false (segreteria): nessun limite — serve a correggere un errore di digitazione
   * di tre giorni fa, e chi lo fa è la persona che risponde del dato.
   */
  soloGiorniNonPassati?: boolean
}

/**
 * Toglie l'assenza: il ragazzo alla fine viene.
 *
 * Si cancella la riga invece di marcarla "annullata" perché qui non c'è niente da
 * conservare: un avviso ritirato prima del giorno non è successo. Diverso dai
 * consensi, dove ogni cambiamento è una prova e non si cancella mai nulla.
 */
export async function annullaAssenza(id: string, opzioni: AnnullaAssenzaOpzioni = {}) {
  const riga = await db.query.assenze.findFirst({
    where: eq(assenze.id, id),
    columns: { id: true, studentId: true, data: true },
  })

  // "Non trovata" anche quando esiste ma non è sua: a chi non ha il diritto di
  // vederla non si racconta nemmeno che esiste.
  const ammessi = opzioni.studentIdsAmmessi
  if (!riga || (ammessi && !ammessi.includes(riga.studentId))) {
    throw new Error('Assenza non trovata')
  }

  if (opzioni.soloGiorniNonPassati && riga.data < oggiRomeStr()) {
    throw new Error('Questo giorno è già passato: l\'assenza resta scritta. Per correggerla chiama la segreteria.')
  }

  await db.delete(assenze).where(eq(assenze.id, id))
  return { ok: true as const, studentId: riga.studentId, data: riga.data }
}

// ─────────────────────────────────────────────
// LEGGERE LE ASSENZE
// ─────────────────────────────────────────────

/** Chi ha avvisato che oggi (o in un altro giorno) non viene */
export async function assenzeDelGiorno(data: string): Promise<RigaAssenza[]> {
  if (!giornoCivileValido(data)) return []
  return await leggi(eq(assenze.data, data), true)
}

/** Le assenze di un periodo, estremi compresi: è la vista del calendario mensile */
export async function assenzeDelPeriodo(da: string, a: string): Promise<RigaAssenza[]> {
  if (!giornoCivileValido(da) || !giornoCivileValido(a)) return []
  return await leggi(and(gte(assenze.data, da), lte(assenze.data, a)), true)
}

/** Le assenze di un alunno, dalla più recente. Con `da`/`a` si restringe il periodo. */
export async function assenzeDiUnAlunno(studentId: string, da?: string, a?: string): Promise<RigaAssenza[]> {
  const filtri = [eq(assenze.studentId, studentId)]
  if (da && giornoCivileValido(da)) filtri.push(gte(assenze.data, da))
  if (a  && giornoCivileValido(a))  filtri.push(lte(assenze.data, a))
  return await leggi(and(...filtri))
}

/** Le assenze di più alunni insieme: è quello che serve al portale di una famiglia */
export async function assenzeDiAlunni(studentIds: string[], da?: string, a?: string): Promise<RigaAssenza[]> {
  if (studentIds.length === 0) return []
  const filtri = [inArray(assenze.studentId, studentIds)]
  if (da && giornoCivileValido(da)) filtri.push(gte(assenze.data, da))
  if (a  && giornoCivileValido(a))  filtri.push(lte(assenze.data, a))
  return await leggi(and(...filtri), true)
}

/**
 * Quello che vede la famiglia nel portale: i giorni già segnalati da oggi in
 * avanti, più un po' di storico per capire «ma l'avevo detto o no?».
 *
 * Trenta giorni indietro e non tutto: nel portale l'elenco si scorre col pollice,
 * e un anno di righe renderebbe invisibile l'unica che interessa (domani).
 */
export async function assenzeFamiglia(studentIds: string[]) {
  const oggi = oggiRomeStr()
  const righe = await assenzeDiAlunni(studentIds, spostaGiorni(oggi, -30))
  return {
    oggi,
    prossime: righe.filter((r) => r.data >= oggi),
    passate:  righe.filter((r) => r.data < oggi).reverse(), // dalla più recente
  }
}

/**
 * Il riquadro della scheda dell'alunno: le ultime assenze e quante ne ha fatte
 * questo mese.
 *
 * Serve a una cosa sola, ed è scritta nel piano: se un ragazzo sparisce per tre
 * settimane te ne devi accorgere, anche se nessuna di quelle assenze ha scalato
 * un centesimo. Il conteggio è un termometro, non un conto da pagare.
 */
export async function riepilogoAssenzeAlunno(studentId: string, limite = 10) {
  const oggi = oggiRomeStr()
  const inizioMese = `${oggi.slice(0, 7)}-01`

  // Sei mesi indietro: abbastanza per vedere un andamento, poco abbastanza da non
  // trasformare la scheda in un archivio.
  const righe = await assenzeDiUnAlunno(studentId, spostaGiorni(oggi, -183))

  return {
    righe: righe.slice(0, limite),
    totale: righe.length,
    questoMese: righe.filter((r) => r.data >= inizioMese && r.data <= oggi).length,
    fuoriTempoQuestoMese: righe.filter((r) => r.data >= inizioMese && r.data <= oggi && r.oltreIlTermine).length,
  }
}
