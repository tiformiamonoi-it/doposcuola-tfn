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
//
// DUE INTERRUTTORI PER SPEGNERLO (aggiunti dopo, su richiesta della segreteria):
// - GENERALE: system_configs.riepilogo_serale_attivo, dalla pagina Impostazioni
//   (scheda Email). Spento lui, o spento l'interruttore di TUTTE le email
//   (email_attive), la sera non parte niente per nessuno.
// - PER ALUNNO: students.riepilogo_serale_attivo, dalla scheda dell'alunno.
//   Spento, quella famiglia non riceve l'email; tutte le altre sì.
// Il generale VINCE sempre sul singolo: se è spento lui, l'interruttore della
// scheda non conta (ed è quello che l'interfaccia deve far capire a colpo d'occhio).
// In nessuno dei due casi la comunicazione sparisce: resta nel portale e si legge
// entrando. Si spegne la posta, non il contenuto.
//
// LE NUOVE CONVENZIONI (aggiunte dopo): nella stessa email della sera, sotto le
// note, finiscono anche le convenzioni (Impostazioni → Sconti) aggiunte
// dall'ultimo annuncio. Quando ce n'è almeno una nuova l'email parte a TUTTE le
// famiglie, anche a quelle senza note; i due interruttori qui sopra valgono anche
// per loro. Una casella riceve comunque UN messaggio solo, con dentro quello che
// la riguarda. Come si riconosce una convenzione "nuova" è spiegato in
// convenzioniDaAnnunciare, qui sotto.
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { studentNotes, students, studentParents, users, systemConfigs } from '../database/schema'
import { randomUUID } from 'node:crypto'
import { sendEmail, emailNoteNelPortale, notificaInvioDiMassa, tipoEmailAttivo } from '../utils/email'
import { confiniGiornoOggiRome } from '../utils/tutor-time-window'

// TETTO DI EMAIL PER GIRO: solo una rete contro le anomalie.
// La quota di Brevo non è più un problema (confermato dalla segreteria), e con le
// convenzioni nuove l'email parte a tutte le famiglie: con ~150 caselle un tetto
// a 120 fermerebbe proprio le sere giuste. Resta un limite alto, che una scuola
// di queste dimensioni non può raggiungere davvero: se lo supera vuol dire che
// qualcosa è andato storto (indirizzi duplicati a valanga, un ciclo impazzito),
// e allora è meglio FERMARSI e segnalarlo che spedire alla cieca.
const MAX_EMAIL_PER_RUN = 1000

// IL SEGNALIBRO DELLE CONVENZIONI, in system_configs accanto alla riga 'sconti'.
// Contiene la data di creazione dell'ultima convenzione già annunciata; lo scrive
// SOLO questo file. Sta in una riga a parte e non dentro il JSON delle convenzioni
// perché quel JSON lo riscrive per intero la pagina Impostazioni a ogni "Salva":
// un timbro messo lì dal riepilogo verrebbe cancellato dal primo salvataggio di
// una pagina aperta da prima. Il salvataggio delle Impostazioni tocca solo le
// righe che invia, quindi questa non la sfiora.
const CHIAVE_CONVENZIONI_ANNUNCIATE = 'sconti_annunciate_fino_a'

/**
 * Le convenzioni da annunciare stasera, più la data dell'ultima (in millisecondi)
 * che diventerà il nuovo segnalibro se l'annuncio parte.
 *
 * NUOVA = ha la data di creazione (creataAt, timbrata da "Aggiungi convenzione")
 * ed è successiva al segnalibro. Quelle senza data sono nate prima che la data
 * esistesse e contano come GIÀ NOTE: è ciò che impedisce, il giorno della messa in
 * linea, di riannunciare a tutte le famiglie le convenzioni di sempre. Segnalibro
 * assente = nessun annuncio fatto finora = valgono tutte quelle con la data.
 */
async function convenzioniDaAnnunciare(): Promise<{ nuove: { nome: string; descrizione: string }[]; ultima: number }> {
  const righe = await db.select({ key: systemConfigs.key, value: systemConfigs.value })
    .from(systemConfigs)
    .where(inArray(systemConfigs.key, ['sconti', CHIAVE_CONVENZIONI_ANNUNCIATE]))
  const valore = (chiave: string) => righe.find((r) => r.key === chiave)?.value ?? ''

  const segnalibro = Date.parse(valore(CHIAVE_CONVENZIONI_ANNUNCIATE))
  let elenco: any
  try { elenco = JSON.parse(valore('sconti') || '[]') } catch { elenco = [] }
  if (!Array.isArray(elenco)) elenco = []

  const nuove: { nome: string; descrizione: string }[] = []
  let ultima = 0
  for (const s of elenco) {
    const creata = Date.parse(s?.creataAt ?? '')
    if (!Number.isFinite(creata)) continue
    if (Number.isFinite(segnalibro) && creata <= segnalibro) continue
    nuove.push({ nome: String(s.nome ?? ''), descrizione: String(s.descrizione ?? '') })
    ultima = Math.max(ultima, creata)
  }
  return { nuove, ultima }
}

// L'INTERRUTTORE GENERALE, in system_configs (riepilogo_serale_attivo). La chiave
// e il valore di partenza stanno insieme a quelli delle altre email, in
// shared/email.ts (INTERRUTTORI_EMAIL).
//
// SE LA RIGA NON C'È, IL RIEPILOGO È ACCESO. È la regola più importante di tutto
// il file: prima che questo interruttore esistesse l'email partiva sempre, e una
// configurazione semplicemente assente non deve spegnere di nascosto un avviso che
// le famiglie si aspettano. Si spegne solo se qualcuno ha scritto "false" apposta.

/**
 * true = stasera le email del riepilogo partono: acceso il suo interruttore E
 * quello di tutte le email. È la stessa domanda che sendEmail fa a ogni email:
 * chiederla qui all'inizio evita centinaia di righe "spenta" nel registro.
 */
export async function riepilogoSeraleAttivoGlobalmente(): Promise<boolean> {
  return await tipoEmailAttivo('RIEPILOGO_SERALE')
}

/** Esito di un giro del riepilogo: serve al log del cron per capire cosa è successo senza tirare a indovinare. */
export interface EsitoRiepilogoNote {
  /** Estremi della finestra di tempo esaminata (formato leggibile italiano) */
  finestra: { da: string; a: string }
  /** Comunicazioni trovate nella finestra, COMPRESE quelle degli alunni con l'avviso spento */
  noteTrovate: number
  /** Alunni per cui si è davvero provato a mandare l'avviso (quelli spenti non sono qui) */
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
  /**
   * Quanti alunni avevano comunicazioni nuove ma l'avviso serale spento sulla loro
   * scheda. È l'unica spia di un interruttore lasciato giù per sbaglio: senza questo
   * numero, un alunno spento a novembre resterebbe muto fino a giugno senza che
   * nessuno se ne accorga.
   */
  alunniConInvioSpento: number
  /**
   * Convenzioni nuove trovate e messe nelle email di stasera. Il segnalibro avanza
   * (e quindi domani non si riannunciano) solo se emailInviate è almeno 1: con la
   * posta del tutto giù, domani ci si riprova.
   */
  convenzioniNuove: number
  /**
   * true quando il giro non ha mandato niente PER SCELTA (interruttore generale
   * spento), non per un guasto. Stessa forma della risposta del cron quando la
   * chiamata arriva fuori orario, così chi legge il registro riconosce subito la
   * differenza tra "non doveva partire" e "è andato storto qualcosa".
   */
  saltato?: boolean
  /** Il perché del salto, in italiano leggibile: finisce nel registro così com'è */
  motivo?: string
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
    alunniConInvioSpento: 0,
    convenzioniNuove: 0,
    ...extra,
  })

  // ── 0. L'INTERRUTTORE GENERALE ──
  // Se la segreteria ha spento il riepilogo serale in Impostazioni, il giro finisce
  // qui: nessuna email, nessuna nota segnata come annunciata. Si esce DICENDOLO,
  // con la stessa forma che il cron usa quando la chiamata arriva fuori orario
  // (saltato + motivo), perché nel registro un giro spento apposta e un giro andato
  // storto non devono somigliarsi.
  if (!(await riepilogoSeraleAttivoGlobalmente())) {
    return esitoVuoto({
      saltato: true,
      motivo: 'Il riepilogo serale (o l\'invio di tutte le email) è spento nelle Impostazioni: nessuna email inviata (le comunicazioni restano nel portale)',
    })
  }

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
    // L'interruttore della singola famiglia viaggia insieme alla nota: si filtra
    // dopo, in memoria, e non nel WHERE, perché le note escluse vanno CONTATE per
    // la spia "alunni saltati" e un filtro in SQL le farebbe sparire e basta.
    invioAttivo:      students.riepilogoSeraleAttivo,
  })
    .from(studentNotes)
    .innerJoin(students, eq(studentNotes.studentId, students.id))
    .where(and(
      eq(studentNotes.visibilita, 'FAMIGLIA'),
      isNull(studentNotes.avvisoInviatoAt),
      gte(studentNotes.approvataAt, inizioFinestra),
      sql`${studentNotes.approvataAt} <= now()`,
    ))

  // ── 1b. LE CONVENZIONI DA ANNUNCIARE ──
  // Si esce a vuoto solo se mancano TUTTE E DUE le cose: una sera senza note ma
  // con una convenzione nuova l'email deve partire lo stesso.
  const { nuove: convenzioni, ultima: ultimaConvenzione } = await convenzioniDaAnnunciare()

  if (note.length === 0 && convenzioni.length === 0) return esitoVuoto()

  // ── 2. RAGGRUPPAMENTO PER ALUNNO ──
  interface Alunno {
    nome: string
    parentName: string | null
    parentEmail: string | null
    noteIds: string[]
  }
  const alunni = new Map<string, Alunno>()

  // GLI ALUNNI CON L'AVVISO SPENTO ESCONO DI SCENA QUI, E LE LORO NOTE NON VENGONO
  // TIMBRATE COME "GIÀ ANNUNCIATE".
  //
  // Timbrarle sarebbe comodo (non tornerebbero mai più a galla) ma sarebbe una
  // bugia scritta nel database: avvisoInviatoAt significa "la famiglia è stata
  // avvisata", e qui la famiglia non è stata avvisata affatto. Lasciandolo vuoto,
  // il giorno in cui la segreteria riaccende l'interruttore l'avviso riparte da
  // solo, senza che nessuno debba andare a ripescare a mano le comunicazioni
  // rimaste indietro.
  //
  // L'effetto collaterale — una raffica di avvisi il giorno della riaccensione —
  // se lo mangia già la finestra di due giorni decisa qui sopra: al massimo
  // ripartono le comunicazioni approvate nelle ultime 48 ore, non l'arretrato di
  // mesi. Per questo la scelta prudente (non timbrare) qui non costa niente.
  const alunniConInvioSpento = new Set<string>()

  for (const n of note) {
    if (!n.invioAttivo) {
      alunniConInvioSpento.add(n.studentId)
      continue
    }
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

  const alunniConNote = alunni.size

  // CON CONVENZIONI NUOVE ENTRANO IN SCENA TUTTI GLI ALUNNI ATTIVI con l'avviso
  // serale acceso, anche senza note: a loro arriva la sola sezione convenzioni
  // (noteIds vuoto). Chi ha già delle note è già nell'elenco e non si duplica.
  // Gli alunni con l'interruttore spento restano fuori anche qui: la segreteria
  // ha chiesto che valga per tutta la posta della sera, non solo per le note.
  if (convenzioni.length > 0) {
    const attivi = await db.select({
      id:          students.id,
      firstName:   students.firstName,
      parentName:  students.parentName,
      parentEmail: students.parentEmail,
    })
      .from(students)
      .where(and(eq(students.active, true), eq(students.riepilogoSeraleAttivo, true)))

    for (const s of attivi) {
      if (alunni.has(s.id)) continue
      alunni.set(s.id, { nome: s.firstName, parentName: s.parentName, parentEmail: s.parentEmail, noteIds: [] })
    }
  }

  // Se TUTTE le note trovate erano di alunni con l'avviso spento (e non ci sono
  // convenzioni da annunciare) non resta niente da spedire, ma il giro non è
  // "vuoto": il conteggio degli alunni saltati deve arrivare lo stesso nel
  // registro. (Serve anche a evitare la query qui sotto con un elenco di id vuoto.)
  if (alunni.size === 0) {
    return esitoVuoto({ noteTrovate: note.length, alunniConInvioSpento: alunniConInvioSpento.size, convenzioniNuove: convenzioni.length })
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
      // Un figlio senza note (entrato solo per le convenzioni) non va nominato:
      // "0 comunicazioni per Luca" sarebbe un rumore. La casella resta comunque
      // in elenco e riceve la sezione convenzioni.
      if (alunno.noteIds.length > 0) {
        dest.figli.push({ nome: alunno.nome, quante: alunno.noteIds.length })
        dest.noteIds.push(...alunno.noteIds)
      }
      destinatari.set(chiave, dest)
    }
  }

  const elenco = [...destinatari.values()]
  if (elenco.length === 0) {
    return esitoVuoto({ noteTrovate: note.length, alunniConNote, alunniSenzaRecapito, alunniConInvioSpento: alunniConInvioSpento.size, convenzioniNuove: convenzioni.length })
  }

  // Il tetto ferma TUTTO il giro invece di mandarne una parte e tagliare il resto:
  // se il numero è anomalo, il problema va guardato in faccia prima di spedire.
  if (elenco.length > MAX_EMAIL_PER_RUN) {
    console.error(
      `[note-digest] Fermato: ${elenco.length} email da mandare, oltre il tetto di sicurezza di ${MAX_EMAIL_PER_RUN}. ` +
      'Nessuna email inviata: controllare indirizzi duplicati o note arretrate approvate in blocco.'
    )
    return esitoVuoto({
      noteTrovate: note.length,
      alunniConNote,
      destinatari: elenco.length,
      alunniSenzaRecapito,
      tettoRaggiunto: true,
      alunniConInvioSpento: alunniConInvioSpento.size,
      convenzioniNuove: convenzioni.length,
    })
  }

  // ── 5. INVIO ──
  // Il link porta dritto alla pagina Note del portale. Senza appUrl configurato
  // resta un avviso senza pulsante: meglio di un link che non porta da nessuna parte.
  const config = useRuntimeConfig()
  const base = (config.appUrl ?? '').replace(/\/+$/, '')
  const link = base ? `${base}/portale/note` : undefined
  const linkConvenzioni = base ? `${base}/portale/sconti` : undefined

  let emailInviate = 0
  const falliti: EsitoRiepilogoNote['falliti'] = []
  const noteDaSegnare = new Set<string>()
  // Tutte le email di stasera sotto lo stesso invio: nel registro si ritrovano
  // insieme, e alla fine parte UNA notifica riassuntiva invece di una a testa.
  const invioId = randomUUID()

  for (const dest of elenco) {
    // Un invio che va male non deve far saltare il giro degli altri: si registra
    // e si tira dritto. Stesso spirito del try/catch già presente nel cron dei
    // pacchetti. sendEmail di suo non lancia mai, ma il try è la cintura oltre
    // alle bretelle: qui dentro ci finisce anche un guasto imprevisto.
    try {
      const contenuto = emailNoteNelPortale({ nome: dest.nome, figli: dest.figli, link, convenzioni, linkConvenzioni })
      const esito = await sendEmail({ to: dest.email, tipo: 'RIEPILOGO_SERALE', nomeDestinatario: dest.nome, invioId, ...contenuto })

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

  await notificaInvioDiMassa(invioId, 'Riepilogo serale')

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

  // ── 7. IL SEGNALIBRO DELLE CONVENZIONI ──
  // Stesso spirito del timbro sulle note: si sposta in avanti solo se almeno
  // un'email è partita davvero (tutte le email di stasera contengono le
  // convenzioni). Con Brevo del tutto giù resta dov'è e domani si riprova.
  //
  // PERCHÉ LA DATA DELL'ULTIMA CONVENZIONE ANNUNCIATA E NON L'ORA DEL GIRO: la
  // data di creazione si timbra quando la segreteria preme "Aggiungi
  // convenzione", ma la convenzione arriva nel database solo con "Salva
  // Modifiche", magari qualche minuto dopo. Con l'ora del giro, una convenzione
  // aggiunta alle 19:58 e salvata alle 20:05 resterebbe per sempre "più vecchia
  // del segnalibro" e non verrebbe annunciata mai. Così invece entra nel giro di
  // domani sera.
  if (convenzioni.length > 0 && emailInviate > 0) {
    const value = new Date(ultimaConvenzione).toISOString()
    await db.insert(systemConfigs)
      .values({ key: CHIAVE_CONVENZIONI_ANNUNCIATE, value })
      .onConflictDoUpdate({ target: systemConfigs.key, set: { value, updatedAt: new Date() } })
  }

  return {
    finestra,
    noteTrovate: note.length,
    alunniConNote,
    destinatari: elenco.length,
    emailInviate,
    emailFallite: falliti.length,
    falliti,
    alunniSenzaRecapito,
    noteSegnate: noteDaSegnare.size,
    tettoRaggiunto: false,
    alunniConInvioSpento: alunniConInvioSpento.size,
    convenzioniNuove: convenzioni.length,
  }
}
