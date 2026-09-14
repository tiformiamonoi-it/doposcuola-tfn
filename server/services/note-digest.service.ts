// RIEPILOGO SERALE DELLE NOTE (voce A3 del piano, decisioni Q14 e Q23).
//
// Ogni sera alle 20 italiane il gestionale guarda quali comunicazioni per la
// famiglia sono diventate VISIBILI nella giornata e manda un avviso a chi di
// dovere. Tre paletti, presi dal piano e non negoziabili:
//
// 1. L'email NON contiene la nota: solo "c'è una nuova comunicazione, entra nel
//    portale". Il testo di una nota è un dato delicato e la posta resta
//    leggibile per sempre (vedi emailNoteNelPortale in utils/email.ts).
// 2. Conta il momento dell'APPROVAZIONE, non quello della scrittura: una nota
//    scritta da un tutor è invisibile alla famiglia finché ADMIN/SUPER_TUTOR non
//    l'approva. Avvisare prima significherebbe annunciare una nota che poi
//    potrebbe essere corretta o bocciata.
// 3. Mai un'email a vuoto: se per quell'alunno non c'è niente, non parte niente.
//    Una casella che riceve solo email "piene" resta di buona reputazione e non
//    finisce nello spam — che è poi l'unico modo perché le email arrivino davvero.
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { studentNotes, students, studentParents, users } from '../database/schema'
import { sendEmail, emailNoteNelPortale } from '../utils/email'
import { confiniGiornoOggiRome } from '../utils/tutor-time-window'

// TETTO PRUDENTE DI EMAIL PER GIRO.
// Il piano gratuito di Brevo si ferma a 300 email al giorno, e quella quota è
// condivisa con gli avvisi dei pacchetti e con gli inviti a scegliere la
// password. Con ~99 alunni un riepilogo normale sta sotto le 50 email: se un
// giorno ne venissero fuori più di 120 vuol dire che è successo qualcosa di
// anomalo (un'approvazione in blocco dell'arretrato, per esempio). In quel caso
// è meglio FERMARSI e segnalarlo che bruciare la quota giornaliera e lasciare
// la scuola senza posta per il resto della giornata.
const MAX_EMAIL_PER_RUN = 120

/** Esito di un giro del riepilogo: serve al log del cron per capire cosa è successo senza tirare a indovinare. */
export interface EsitoRiepilogoNote {
  /** Estremi della finestra di tempo esaminata (formato leggibile italiano) */
  finestra: { da: string; a: string }
  noteTrovate: number
  alunniConNote: number
  destinatari: number
  emailInviate: number
  emailFallite: number
  /** Chi non ha ricevuto l'avviso e perché — l'elenco serve alla segreteria per rimediare a mano */
  falliti: { email: string; motivo: string; dettaglio?: string }[]
  /** Alunni senza nessun recapito: né un genitore con account attivo né l'email in anagrafica */
  alunniSenzaRecapito: string[]
  noteSegnate: number
  /** true quando il tetto prudente ha fermato il giro prima di mandare qualcosa */
  tettoRaggiunto: boolean
}

/** "Maria Rossi" → "Maria". Nell'email si dà del tu, il cognome suonerebbe da ufficio. */
function primoNome(nomeCompleto: string | null | undefined): string | undefined {
  const pulito = (nomeCompleto ?? '').trim()
  if (!pulito) return undefined
  return pulito.split(/\s+/)[0]
}

/** Le email si confrontano senza badare a maiuscole e spazi: "Mario@X.it" e "mario@x.it" sono la stessa casella. */
function chiaveEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function runNoteDigest(): Promise<EsitoRiepilogoNote> {
  // ── LA FINESTRA DI TEMPO ──
  // Il piano promette due cose insieme: il riepilogo è della giornata, ma "una
  // nota approvata dopo le 20 entra nel riepilogo del giorno successivo".
  // Guardare SOLO il giorno civile di oggi tradirebbe la seconda promessa: una
  // nota approvata ieri alle 20:30, quando il riepilogo di ieri era già partito,
  // non verrebbe annunciata mai più. Per questo la finestra parte dall'inizio di
  // IERI (ora italiana) e la colonna avvisoInviatoAt fa da filtro fine: tutto
  // quello che è già stato annunciato resta fuori comunque.
  //
  // La finestra è anche una rete di sicurezza per il PRIMO giro dopo la messa in
  // linea: senza un limite indietro nel tempo, tutte le note approvate negli
  // anni (mai annunciate, quindi con avvisoInviatoAt vuoto) partirebbero tutte
  // insieme in faccia alle famiglie. Con due giorni di finestra, no.
  const { start: inizioOggi } = confiniGiornoOggiRome()
  const inizioFinestra = new Date(inizioOggi.getTime() - 24 * 60 * 60 * 1000)
  const adesso = new Date()

  const finestra = {
    da: inizioFinestra.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Rome' }),
    a:  adesso.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Rome' }),
  }

  const esitoVuoto = (extra: Partial<EsitoRiepilogoNote> = {}): EsitoRiepilogoNote => ({
    finestra,
    noteTrovate: 0,
    alunniConNote: 0,
    destinatari: 0,
    emailInviate: 0,
    emailFallite: 0,
    falliti: [],
    alunniSenzaRecapito: [],
    noteSegnate: 0,
    tettoRaggiunto: false,
    ...extra,
  })

  // ── 1. LE NOTE DA ANNUNCIARE ──
  // Solo visibilità FAMIGLIA (le INTERNE non escono dal gestionale), solo
  // approvate (approvataAt valorizzato: è quello il momento in cui la nota
  // diventa davvero visibile nel portale) e solo non ancora annunciate.
  const note = await db.select({
    id:               studentNotes.id,
    studentId:        studentNotes.studentId,
    studentFirstName: students.firstName,
    studentLastName:  students.lastName,
    parentName:       students.parentName,
    parentEmail:      students.parentEmail,
  })
    .from(studentNotes)
    .innerJoin(students, eq(studentNotes.studentId, students.id))
    .where(and(
      eq(studentNotes.visibilita, 'FAMIGLIA'),
      isNull(studentNotes.avvisoInviatoAt),
      gte(studentNotes.approvataAt, inizioFinestra),
      sql`${studentNotes.approvataAt} <= now()`,
    ))

  if (note.length === 0) return esitoVuoto()

  // ── 2. RAGGRUPPAMENTO PER ALUNNO ──
  interface Alunno {
    nome: string
    parentName: string | null
    parentEmail: string | null
    noteIds: string[]
  }
  const alunni = new Map<string, Alunno>()
  for (const n of note) {
    const esistente = alunni.get(n.studentId)
    if (esistente) {
      esistente.noteIds.push(n.id)
      continue
    }
    alunni.set(n.studentId, {
      // Nell'email basta il nome di battesimo: è il figlio di chi legge, non una pratica
      nome: n.studentFirstName,
      parentName: n.parentName,
      parentEmail: n.parentEmail,
      noteIds: [n.id],
    })
  }

  // ── 3. I DESTINATARI ──
  // Stesso criterio degli avvisi sui pacchetti: tutti i genitori collegati con
  // un account ATTIVO; se un alunno non ne ha nessuno si ripiega sull'email di
  // contatto in anagrafica, che è comunque un recapito che la famiglia ci ha dato.
  const studentIds = [...alunni.keys()]
  const genitoriRows = await db.select({
    studentId: studentParents.studentId,
    email:     users.email,
    firstName: users.firstName,
  })
    .from(studentParents)
    .innerJoin(users, eq(studentParents.parentUserId, users.id))
    .where(and(inArray(studentParents.studentId, studentIds), eq(users.active, true)))

  const genitoriPerAlunno = new Map<string, { email: string; nome: string }[]>()
  for (const g of genitoriRows) {
    const lista = genitoriPerAlunno.get(g.studentId) ?? []
    if (!lista.some((x) => chiaveEmail(x.email) === chiaveEmail(g.email))) {
      lista.push({ email: g.email, nome: g.firstName })
    }
    genitoriPerAlunno.set(g.studentId, lista)
  }

  // ── 4. UNA SOLA EMAIL PER DESTINATARIO ──
  // Chi ha due figli con novità riceve UN messaggio che parla di entrambi: due
  // email nello stesso minuto dallo stesso mittente sembrano un errore e i
  // filtri antispam le trattano peggio. Per questo si raggruppa per casella, non
  // per alunno.
  interface Destinatario {
    email: string
    nome?: string
    figli: { nome: string; quante: number }[]
    noteIds: string[]
  }
  const destinatari = new Map<string, Destinatario>()
  const alunniSenzaRecapito: string[] = []

  for (const [studentId, alunno] of alunni) {
    const conAccount = genitoriPerAlunno.get(studentId) ?? []
    const recapiti = conAccount.length > 0
      ? conAccount
      : (alunno.parentEmail ? [{ email: alunno.parentEmail, nome: primoNome(alunno.parentName) ?? '' }] : [])

    if (recapiti.length === 0) {
      // Non è un errore del programma: è un alunno la cui famiglia non ci ha mai
      // lasciato un indirizzo. Va segnalato, così la segreteria può rimediare.
      alunniSenzaRecapito.push(alunno.nome)
      continue
    }

    for (const r of recapiti) {
      const chiave = chiaveEmail(r.email)
      const dest = destinatari.get(chiave) ?? { email: r.email, nome: primoNome(r.nome), figli: [], noteIds: [] }
      dest.figli.push({ nome: alunno.nome, quante: alunno.noteIds.length })
      dest.noteIds.push(...alunno.noteIds)
      destinatari.set(chiave, dest)
    }
  }

  const elenco = [...destinatari.values()]
  if (elenco.length === 0) {
    return esitoVuoto({ noteTrovate: note.length, alunniConNote: alunni.size, alunniSenzaRecapito })
  }

  // Il tetto ferma TUTTO il giro invece di mandarne 120 e tagliare il resto: se
  // il numero è anomalo, il problema va guardato in faccia prima di spedire.
  if (elenco.length > MAX_EMAIL_PER_RUN) {
    console.error(
      `[note-digest] Fermato: ${elenco.length} email da mandare, oltre il tetto prudente di ${MAX_EMAIL_PER_RUN}. ` +
      'Nessuna email inviata: controllare se sono state approvate note arretrate in blocco.'
    )
    return esitoVuoto({
      noteTrovate: note.length,
      alunniConNote: alunni.size,
      destinatari: elenco.length,
      alunniSenzaRecapito,
      tettoRaggiunto: true,
    })
  }

  // ── 5. INVIO ──
  // Il link porta dritto alla pagina Note del portale. Senza appUrl configurato
  // resta un avviso senza pulsante: meglio di un link che non porta da nessuna parte.
  const config = useRuntimeConfig()
  const base = (config.appUrl ?? '').replace(/\/+$/, '')
  const link = base ? `${base}/portale/note` : undefined

  let emailInviate = 0
  const falliti: EsitoRiepilogoNote['falliti'] = []
  const noteDaSegnare = new Set<string>()

  for (const dest of elenco) {
    // Un invio che va male non deve far saltare il giro degli altri: si registra
    // e si tira dritto. Stesso spirito del try/catch già presente nel cron dei
    // pacchetti. sendEmail di suo non lancia mai, ma il try è la cintura oltre
    // alle bretelle: qui dentro ci finisce anche un guasto imprevisto.
    try {
      const contenuto = emailNoteNelPortale({ nome: dest.nome, figli: dest.figli, link })
      const esito = await sendEmail({ to: dest.email, ...contenuto })

      if (esito.sent) {
        emailInviate++
        // Le note si segnano SOLO se l'email è davvero partita: se Brevo è giù,
        // restano da annunciare e il giro di domani riprova (rientrano nella
        // finestra di due giorni).
        for (const id of dest.noteIds) noteDaSegnare.add(id)
      } else {
        falliti.push({ email: dest.email, motivo: esito.motivo, dettaglio: esito.dettaglio })
      }
    } catch (err) {
      console.error('[note-digest] Invio non riuscito a', dest.email, err)
      falliti.push({ email: dest.email, motivo: 'IMPREVISTO', dettaglio: err instanceof Error ? err.message : undefined })
    }
  }

  // ── 6. IL TIMBRO CONTRO I DOPPIONI ──
  // Da qui in poi queste note risultano "già annunciate": se il riepilogo
  // ripartisse stasera stessa (riavvio, doppia chiamata del cron, prova manuale
  // della segreteria) non troverebbe più niente e non manderebbe niente.
  // Nota: se un alunno ha due genitori e l'email è partita a uno solo, la nota
  // viene comunque segnata. È la stessa scelta degli avvisi sui pacchetti:
  // meglio un avviso arrivato a uno dei due che un doppione al primo.
  if (noteDaSegnare.size > 0) {
    await db.update(studentNotes)
      .set({ avvisoInviatoAt: new Date() })
      .where(inArray(studentNotes.id, [...noteDaSegnare]))
  }

  return {
    finestra,
    noteTrovate: note.length,
    alunniConNote: alunni.size,
    destinatari: elenco.length,
    emailInviate,
    emailFallite: falliti.length,
    falliti,
    alunniSenzaRecapito,
    noteSegnate: noteDaSegnare.size,
    tettoRaggiunto: false,
  }
}
