import { and, asc, count, desc, eq, ilike, isNotNull, isNull, lte, notInArray, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../database/client'
import { contacts, contactInteractions, students, users } from '../database/schema'
import { nomeProprio } from '../utils/nomi'
import { oggiRomeStr } from '../utils/tutor-time-window'
// Il ponte con i Rientri (l'import va in questo verso soltanto: confirmation.service
// non conosce i contatti, così non si creano import circolari)
import { getAnnoCorrente, setRientro } from './confirmation.service'
import { normalizzaTelefono, sembraTelefono, sembraEmail } from '#shared/phone'
import { STATI_CHIUSI } from '#shared/contatti'
import type { TipoContatto } from '#shared/contatti'
import { normalizzaRigaImport } from '#shared/contatti-import'
import type { RigaImportContatto } from '#shared/contatti-import'
import type {
  CreateContactInput,
  UpdateContactInput,
  CreateInteractionInput,
  ListContactsQuery,
} from '#shared/schemas/contact.schema'

// Convenzione di progetto: i service segnalano gli errori di dominio con
// `new Error('messaggio in italiano')`; gli handler li traducono in errori HTTP.

type ContactChanges = Partial<typeof contacts.$inferInsert>

// Un contatto è "da ricontattare" se ha un post-it con data odierna o passata
// e non è già chiuso (convertito o perso). Costruito con gli operatori Drizzle
// (query parametrica, nessuna concatenazione di stringhe).
function daRicontattareEntro(giorno: string) {
  return and(
    isNotNull(contacts.prossimoRicontatto),
    lte(contacts.prossimoRicontatto, giorno),
    notInArray(contacts.stato, [...STATI_CHIUSI]),
  ) as SQL
}

// Convertiti nel mese civile italiano indicato ('YYYY-MM'): il confronto avviene
// sulla data riportata in Europe/Rome, non su quella UTC salvata nel database.
function convertitiNelMese(mese: string) {
  return and(
    eq(contacts.stato, 'CONVERTITO'),
    isNotNull(contacts.convertitoAt),
    sql`to_char(${contacts.convertitoAt} AT TIME ZONE 'Europe/Rome', 'YYYY-MM') = ${mese}`,
  ) as SQL
}

// Neutralizza i caratteri jolly di LIKE/ILIKE nel testo digitato dall'utente.
// (Postgres usa '\' come carattere di escape predefinito.)
function escapeLike(testo: string) {
  return testo.replace(/[\\%_]/g, (c) => `\\${c}`)
}

// Vero se il testo "sembra" un profilo o una chat social: un link a uno dei
// social più usati oppure un @nomeutente. Serve al form pubblico del sito, dove
// c'è un campo unico "contatto".
const SITI_SOCIAL = ['instagram.com', 'facebook.com', 'tiktok.com', 't.me', 'wa.me']

function sembraSocial(valore: string): boolean {
  const v = (valore ?? '').trim().toLowerCase()
  if (!v) return false
  if (v.startsWith('@')) return true
  return SITI_SOCIAL.some((sito) => v.includes(sito))
}

// Regola unica per convertitoAt: si valorizza entrando in CONVERTITO, si azzera uscendone
function aggiornaConvertitoAt(changes: ContactChanges, nuovoStato: string | null | undefined, convertitoAtAttuale: Date | null) {
  if (!nuovoStato) return
  if (nuovoStato === 'CONVERTITO') {
    if (!convertitoAtAttuale) changes.convertitoAt = new Date()
  } else if (convertitoAtAttuale) {
    changes.convertitoAt = null
  }
}

// ─────────────────────────────────────────────
// LIST + KPI — GET /api/contacts
// Una sola chiamata HTTP, due query in parallelo (lista + conteggi delle card).
// ─────────────────────────────────────────────

export async function listContacts(q: ListContactsQuery) {
  const oggi = oggiRomeStr()
  const meseCorrente = oggi.slice(0, 7) // 'YYYY-MM'

  const filtri = [
    eq(contacts.tipo, q.tipo),
    q.includiArchiviati ? undefined : isNull(contacts.archiviatoAt),
    q.stato ? eq(contacts.stato, q.stato) : undefined,
    q.canale ? eq(contacts.canaleOrigine, q.canale) : undefined,
    // "Chi è" esiste solo nel cassetto Doposcuola: altrove il filtro non si applica
    (q.tipo === 'DOPOSCUOLA' && q.ruolo) ? eq(contacts.doposcuolaRuolo, q.ruolo) : undefined,
    q.daRicontattare ? daRicontattareEntro(oggi) : undefined,
    // Stessa espressione del numero mostrato sulla card, così lista e numero coincidono
    q.convertitiMese ? convertitiNelMese(meseCorrente) : undefined,
  ]

  if (q.search) {
    // '%', '_' e '\' sono caratteri speciali di LIKE: vanno neutralizzati, altrimenti
    // digitare "100%" o "a_b" cercherebbe "qualsiasi cosa" invece del testo scritto.
    const testo = `%${escapeLike(q.search)}%`
    const perTesto = [
      ilike(contacts.nome, testo),
      ilike(contacts.cognome, testo),
      ilike(contacts.telefono, testo),
      ilike(contacts.email, testo),
      ilike(contacts.socialLink, testo),
      ilike(contacts.nomeStudente, testo),
      ilike(contacts.azienda, testo),
    ]
    // Se si sta cercando un numero, cerchiamo anche la sua forma normalizzata:
    // "333 123" e "+39333123" devono trovare la stessa persona.
    if (sembraTelefono(q.search)) {
      const normalizzato = normalizzaTelefono(q.search)
      if (normalizzato) perTesto.push(ilike(contacts.telefono, `%${escapeLike(normalizzato)}%`))
    }
    filtri.push(or(...perTesto))
  }

  const where = and(...filtri)

  // Prima chi è da richiamare (post-it scaduto o di oggi), poi chi si è "mosso" più di recente.
  // Per chi non è mai stato sentito vale la data di inserimento: un contatto appena
  // aggiunto a mano deve comparire in cima, non in fondo alla lista.
  const priorita = sql`CASE WHEN ${daRicontattareEntro(oggi)} THEN 0 ELSE 1 END`
  const recenza = sql`COALESCE(${contacts.ultimoContattoAt}, ${contacts.createdAt}) DESC`

  // I 4 numeri delle card + i totali delle due tab: un'unica scansione con
  // COUNT(*) FILTER (WHERE …), lanciata in parallelo alla lista.
  const soloTipo = eq(contacts.tipo, q.tipo)
  const conta = (condizione: SQL) => sql<string>`COUNT(*) FILTER (WHERE ${condizione})::text`

  const [righe, [totaleRow], [kpiRow]] = await Promise.all([
    db.select().from(contacts)
      .where(where)
      .orderBy(priorita, recenza, desc(contacts.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),

    db.select({ n: count() }).from(contacts).where(where),

    db.select({
      nuovi:              conta(and(soloTipo, eq(contacts.stato, 'NUOVO')) as SQL),
      daRicontattareOggi: conta(and(soloTipo, daRicontattareEntro(oggi)) as SQL),
      inTrattativa:       conta(and(soloTipo, eq(contacts.stato, 'IN_TRATTATIVA')) as SQL),
      // Stessa espressione del filtro della card: numero e lista non possono discordare
      convertitiMese:     conta(and(soloTipo, convertitiNelMese(meseCorrente)) as SQL),
      totaleDoposcuola:   conta(eq(contacts.tipo, 'DOPOSCUOLA')),
      totaleMarketing:    conta(eq(contacts.tipo, 'MARKETING')),
      // Quanti, fra i Doposcuola, sono candidati tutor: serve al filtro "Chi è"
      totaleTutorDoposcuola: conta(and(
        eq(contacts.tipo, 'DOPOSCUOLA'),
        eq(contacts.doposcuolaRuolo, 'TUTOR'),
      ) as SQL),
    }).from(contacts).where(isNull(contacts.archiviatoAt)),
  ])

  const total = totaleRow?.n ?? 0

  return {
    items: righe,
    total,
    meta: {
      page:       q.page,
      pageSize:   q.pageSize,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    },
    kpi: {
      nuovi:              Number(kpiRow?.nuovi ?? 0),
      daRicontattareOggi: Number(kpiRow?.daRicontattareOggi ?? 0),
      inTrattativa:       Number(kpiRow?.inTrattativa ?? 0),
      convertitiMese:     Number(kpiRow?.convertitiMese ?? 0),
      totaleDoposcuola:   Number(kpiRow?.totaleDoposcuola ?? 0),
      totaleMarketing:    Number(kpiRow?.totaleMarketing ?? 0),
      totaleTutorDoposcuola: Number(kpiRow?.totaleTutorDoposcuola ?? 0),
    },
  }
}

// ─────────────────────────────────────────────
// BADGE DEL MENU — quanti contatti sono da ricontattare oggi
// Entrambe le tab insieme, archiviati esclusi. Una sola COUNT sull'indice.
// ─────────────────────────────────────────────

export async function countContactsDaRicontattare() {
  const [riga] = await db.select({ n: count() })
    .from(contacts)
    .where(and(isNull(contacts.archiviatoAt), daRicontattareEntro(oggiRomeStr())))

  return riga?.n ?? 0
}

// ─────────────────────────────────────────────
// GET ONE — scheda + diario (le due letture partono insieme)
// ─────────────────────────────────────────────

const nomeCompleto = (idCol: unknown, nome: unknown, cognome: unknown) =>
  sql<string | null>`CASE WHEN ${idCol} IS NULL THEN NULL ELSE ${nome} || ' ' || ${cognome} END`

export async function getContact(id: string) {
  const [[riga], interazioni] = await Promise.all([
    db.select({
      contatto:     contacts,
      studenteNome: nomeCompleto(students.id, students.firstName, students.lastName),
      creatoDaNome: nomeCompleto(users.id, users.firstName, users.lastName),
    })
      .from(contacts)
      .leftJoin(students, eq(contacts.studentId, students.id))
      .leftJoin(users, eq(contacts.createdByUserId, users.id))
      .where(eq(contacts.id, id))
      .limit(1),

    db.select({
      id:         contactInteractions.id,
      contactId:  contactInteractions.contactId,
      tipo:       contactInteractions.tipo,
      direzione:  contactInteractions.direzione,
      canale:     contactInteractions.canale,
      esito:      contactInteractions.esito,
      note:       contactInteractions.note,
      data:       contactInteractions.data,
      createdAt:  contactInteractions.createdAt,
      autoreNome: nomeCompleto(users.id, users.firstName, users.lastName),
    })
      .from(contactInteractions)
      .leftJoin(users, eq(contactInteractions.createdByUserId, users.id))
      .where(eq(contactInteractions.contactId, id))
      .orderBy(desc(contactInteractions.data)),
  ])

  if (!riga) throw new Error('Contatto non trovato')

  return {
    ...riga.contatto,
    studenteNome: riga.studenteNome,
    creatoDaNome: riga.creatoDaNome,
    interazioni,
  }
}

// ─────────────────────────────────────────────
// CREATE / UPDATE
// ─────────────────────────────────────────────

export async function createContact(data: CreateContactInput, userId: string) {
  const valori: typeof contacts.$inferInsert = {
    tipo:               data.tipo,
    nome:               nomeProprio(data.nome),
    cognome:            data.cognome ? nomeProprio(data.cognome) : null,
    telefono:           data.telefono ?? null,
    email:              data.email ?? null,
    socialLink:         data.socialLink ?? null,
    canaleOrigine:      data.canaleOrigine,
    stato:              data.stato,
    prossimoRicontatto: data.prossimoRicontatto ?? null,
    note:               data.note ?? null,
    nomeStudente:       data.nomeStudente ?? null,
    classeScuola:       data.classeScuola ?? null,
    materie:            data.materie ?? null,
    azienda:            data.azienda ?? null,
    servizioInteresse:  data.servizioInteresse ?? null,
    marketingRuolo:     data.marketingRuolo ?? null,
    doposcuolaRuolo:    data.doposcuolaRuolo ?? 'STUDENTE',
    privacyInformata:   data.privacyInformata,
    createdByUserId:    userId,
    // Se nasce già "Convertito" (import/casi particolari) segniamo subito la data
    convertitoAt:       data.stato === 'CONVERTITO' ? new Date() : null,
  }

  const prima = data.primaInterazione

  // Caso normale: si scrive solo la rubrica, esattamente come prima
  if (!prima) {
    const [creato] = await db.insert(contacts).values(valori).returning()
    return creato
  }

  // È stato indicato quando ci si è sentiti la prima volta: rubrica e prima riga
  // del diario nella stessa operazione (o tutte e due, o nessuna delle due).
  const quando = new Date(prima.data)

  return await db.transaction(async (tx) => {
    const [creato] = await tx.insert(contacts)
      .values({ ...valori, ultimoContattoAt: quando })
      .returning()

    if (!creato) throw new Error('Creazione del contatto non riuscita')

    await tx.insert(contactInteractions).values({
      contactId:       creato.id,
      tipo:            prima.tipo,
      direzione:       prima.direzione,
      // Canale non scelto a mano: vale la fonte del contatto
      canale:          prima.canale ?? data.canaleOrigine,
      note:            prima.note ?? null,
      data:            quando,
      createdByUserId: userId,
    })

    return creato
  })
}

/**
 * Il contatto appena diventato alunno entra nell'appello dei Rientri già
 * "Confermato": si è appena iscritto, è ovvio che viene (regola d'oro §2 del
 * piano: nessuno sta insieme nei Contatti e nei Rientri).
 * Se qualcosa qui va storto NON si annulla la conversione: il contatto è già
 * diventato studente, ed è quello che conta.
 */
async function segnaRientroConfermato(studentId: string, userId: string) {
  try {
    const { anno } = await getAnnoCorrente()
    await setRientro(
      studentId,
      anno,
      { stato: 'CONFERMATO', dataRisposta: oggiRomeStr(), note: 'Nuovo iscritto arrivato dai Contatti' },
      userId,
    )
  } catch (err) {
    console.error('[contatti] conversione riuscita ma rientro non segnato:', err)
  }
}

export async function updateContact(id: string, data: UpdateContactInput, userId: string) {
  const [esistente] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1)
  if (!esistente) throw new Error('Contatto non trovato')

  const changes: ContactChanges = { updatedAt: new Date() }
  for (const [chiave, valore] of Object.entries(data)) {
    if (valore !== undefined) (changes as Record<string, unknown>)[chiave] = valore
  }

  // Stessa garanzia della creazione: non si può restare senza NESSUN recapito.
  // Si controlla il risultato finale (modifiche unite ai dati già salvati), così
  // non si svuota l'ultimo recapito rimasto con una modifica parziale.
  // Il controllo scatta solo se la richiesta tocca davvero telefono, email o
  // profilo social: le richieste del sito possono creare contatti senza recapiti
  // riconosciuti e devono restare modificabili nel resto.
  if (changes.telefono !== undefined || changes.email !== undefined || changes.socialLink !== undefined) {
    const telefonoFinale = changes.telefono   !== undefined ? changes.telefono   : esistente.telefono
    const emailFinale    = changes.email      !== undefined ? changes.email      : esistente.email
    const socialFinale   = changes.socialLink !== undefined ? changes.socialLink : esistente.socialLink
    if (!telefonoFinale && !emailFinale && !socialFinale) {
      throw new Error('Inserisci almeno un recapito: telefono, email o profilo social')
    }
  }

  // Nomi sempre in formato "Nome Proprio" (mai tutto maiuscolo/minuscolo)
  if (typeof changes.nome === 'string') changes.nome = nomeProprio(changes.nome)
  if (typeof changes.cognome === 'string' && changes.cognome) changes.cognome = nomeProprio(changes.cognome)

  aggiornaConvertitoAt(changes, data.stato, esistente.convertitoAt)

  const [aggiornato] = await db.update(contacts).set(changes).where(eq(contacts.id, id)).returning()

  // È questa la modifica che lo trasforma in alunno ("Crea studente")? Solo
  // allora si apre la riga nei Rientri: le modifiche successive non la toccano.
  const appenaConvertito = Boolean(
    aggiornato
    && aggiornato.stato === 'CONVERTITO'
    && aggiornato.studentId
    && (esistente.stato !== 'CONVERTITO' || !esistente.studentId),
  )
  if (appenaConvertito && aggiornato?.studentId) {
    await segnaRientroConfermato(aggiornato.studentId, userId)
  }

  return aggiornato ?? null
}

// ─────────────────────────────────────────────
// IMPORT DA CSV — POST /api/contacts/import
// Le righe arrivano dal browser così come stanno nel file; qui si traducono
// (stessa funzione dell'anteprima) e si scrivono, saltando i doppioni.
// Una riga sbagliata NON blocca le altre: si segnala e si va avanti.
// ─────────────────────────────────────────────

export async function importContacts(
  righe: RigaImportContatto[],
  tipoDefault: TipoContatto,
  userId: string,
) {
  const saltati: Array<{ riga: number; motivo: string }> = []
  const errori:  Array<{ riga: number; motivo: string }> = []
  let importati = 0

  await db.transaction(async (tx) => {
    // Recapiti già visti in questo stesso file: "chiave del recapito" → numero di riga
    const giaVisti = new Map<string, number>()

    for (const [indice, grezza] of righe.entries()) {
      // Se il browser non ha detto da quale riga viene, si conta dall'intestazione (riga 1)
      const numeroRiga = grezza.riga ?? indice + 2

      const esito = normalizzaRigaImport(grezza, tipoDefault)
      if (!esito.ok) {
        errori.push({ riga: numeroRiga, motivo: esito.errori.join(' · ') })
        continue
      }

      const d = esito.dati
      const social = d.socialLink ? d.socialLink.toLowerCase() : null
      const chiavi = [
        d.telefono ? `tel:${d.telefono}` : null,
        d.email ? `mail:${d.email}` : null,
        social ? `social:${social}` : null,
      ].filter((c): c is string => c !== null)

      // 1) doppione di una riga precedente dello stesso file
      const chiaveRipetuta = chiavi.find((c) => giaVisti.has(c))
      if (chiaveRipetuta) {
        saltati.push({ riga: numeroRiga, motivo: `doppione di riga ${giaVisti.get(chiaveRipetuta)} dello stesso file` })
        continue
      }

      // 2) doppione di un contatto già in rubrica (archiviati esclusi)
      const [esistente] = await tx.select({ nome: contacts.nome, cognome: contacts.cognome })
        .from(contacts)
        .where(and(
          isNull(contacts.archiviatoAt),
          or(
            d.telefono ? eq(contacts.telefono, d.telefono) : undefined,
            d.email ? sql`lower(${contacts.email}) = ${d.email}` : undefined,
            social ? sql`lower(${contacts.socialLink}) = ${social}` : undefined,
          ),
        ))
        .limit(1)

      if (esistente) {
        const chi = [esistente.cognome, esistente.nome].filter(Boolean).join(' ')
        saltati.push({ riga: numeroRiga, motivo: `doppione di ${chi || 'un contatto'} già in rubrica` })
        continue
      }

      // Salvataggio in un savepoint: se Postgres rifiuta proprio questa riga (es. un valore
      // che la validazione non ha previsto) si segnala SOLO lei e il blocco prosegue,
      // invece di annullare anche le righe buone già scritte.
      try {
        await tx.transaction(async (sp) => {
          await sp.insert(contacts).values({
            tipo:               d.tipo,
            nome:               nomeProprio(d.nome),
            cognome:            d.cognome ? nomeProprio(d.cognome) : null,
            telefono:           d.telefono ?? null,
            email:              d.email ?? null,
            socialLink:         d.socialLink ?? null,
            canaleOrigine:      d.canaleOrigine,
            stato:              d.stato,
            prossimoRicontatto: d.prossimoRicontatto ?? null,
            note:               d.note ?? null,
            nomeStudente:       d.nomeStudente ?? null,
            classeScuola:       d.classeScuola ?? null,
            materie:            d.materie ?? null,
            azienda:            d.azienda ?? null,
            servizioInteresse:  d.servizioInteresse ?? null,
            marketingRuolo:     d.marketingRuolo ?? null,
            doposcuolaRuolo:    d.doposcuolaRuolo ?? 'STUDENTE',
            privacyInformata:   d.privacyInformata,
            createdByUserId:    userId,
            convertitoAt:       d.stato === 'CONVERTITO' ? new Date() : null,
          })
        })
      } catch (err) {
        const dettaglio = err instanceof Error ? err.message.split('\n')[0] : 'errore sconosciuto'
        errori.push({ riga: numeroRiga, motivo: `salvataggio rifiutato dal database (${dettaglio})` })
        continue
      }

      for (const c of chiavi) giaVisti.set(c, numeroRiga)
      importati++
    }
  })

  return { importati, saltati, errori }
}

// ─────────────────────────────────────────────
// ARCHIVIA / RIPRISTINA (cestino morbido: niente cancellazioni definitive)
// ─────────────────────────────────────────────

export async function archiveContact(id: string) {
  const [aggiornato] = await db.update(contacts)
    .set({ archiviatoAt: new Date(), updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning()

  if (!aggiornato) throw new Error('Contatto non trovato')
  return aggiornato
}

export async function restoreContact(id: string) {
  const [aggiornato] = await db.update(contacts)
    .set({ archiviatoAt: null, updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning()

  if (!aggiornato) throw new Error('Contatto non trovato')
  return aggiornato
}

// ─────────────────────────────────────────────
// DIARIO — aggiunta e cancellazione di un'interazione
// ─────────────────────────────────────────────

export async function addInteraction(contactId: string, data: CreateInteractionInput, userId: string) {
  return await db.transaction(async (tx) => {
    const [contatto] = await tx.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    if (!contatto) throw new Error('Contatto non trovato')

    const quando = data.data ? new Date(data.data) : new Date()

    const [interazione] = await tx.insert(contactInteractions).values({
      contactId,
      tipo:            data.tipo,
      direzione:       data.direzione,
      canale:          data.canale,
      esito:           data.esito ?? null,
      note:            data.note ?? null,
      data:            quando,
      createdByUserId: userId,
    }).returning()

    const changes: ContactChanges = { updatedAt: new Date() }

    // "Ultimo contatto" avanza solo se questa interazione è più recente
    if (!contatto.ultimoContattoAt || quando > contatto.ultimoContattoAt) {
      changes.ultimoContattoAt = quando
    }

    if (data.nuovoStato) {
      changes.stato = data.nuovoStato
      aggiornaConvertitoAt(changes, data.nuovoStato, contatto.convertitoAt)
    }

    // null = cancella il post-it, undefined = lascialo com'è
    if (data.prossimoRicontatto !== undefined) {
      changes.prossimoRicontatto = data.prossimoRicontatto
    }

    const [aggiornato] = await tx.update(contacts).set(changes).where(eq(contacts.id, contactId)).returning()

    return { interazione, contatto: aggiornato ?? contatto }
  })
}

export async function deleteInteraction(contactId: string, interactionId: string) {
  return await db.transaction(async (tx) => {
    // Il filtro su ENTRAMBI gli id impedisce di cancellare la riga di un altro contatto
    const [eliminata] = await tx.delete(contactInteractions)
      .where(and(eq(contactInteractions.id, interactionId), eq(contactInteractions.contactId, contactId)))
      .returning()

    if (!eliminata) throw new Error('Interazione non trovata')

    // "Ultimo contatto" ricalcolato dal diario rimasto
    const [ultima] = await tx.select({ quando: sql<Date | null>`MAX(${contactInteractions.data})` })
      .from(contactInteractions)
      .where(eq(contactInteractions.contactId, contactId))

    const [contatto] = await tx.update(contacts)
      .set({ ultimoContattoAt: ultima?.quando ?? null, updatedAt: new Date() })
      .where(eq(contacts.id, contactId))
      .returning()

    return { success: true, contatto: contatto ?? null }
  })
}

// ─────────────────────────────────────────────
// DOPPIONI — cerca sia tra i contatti sia tra gli studenti già clienti
// ─────────────────────────────────────────────

export async function findDuplicates(params: { telefono?: string | null; email?: string | null; social?: string | null }) {
  const telefono = params.telefono ? normalizzaTelefono(params.telefono) : ''
  const email = params.email ? params.email.trim().toLowerCase() : ''
  // Il profilo social si confronta senza distinzione fra maiuscole e minuscole
  const social = params.social ? params.social.trim().toLowerCase() : ''
  if (!telefono && !email && !social) return { contatti: [], studenti: [] }

  // Ultime 8 cifre: nel DB studenti i numeri sono in formati liberi ("333 12 34 567"),
  // quindi filtriamo in SQL sulle sole cifre e confermiamo lato applicazione.
  const coda = telefono.replace(/\D/g, '').slice(-8)
  const soloCifre = (colonna: unknown) => sql`regexp_replace(coalesce(${colonna}, ''), '[^0-9]', '', 'g')`

  const [contattiTrovati, studentiCandidati] = await Promise.all([
    db.select({
      id:         contacts.id,
      nome:       contacts.nome,
      cognome:    contacts.cognome,
      tipo:       contacts.tipo,
      stato:      contacts.stato,
      telefono:   contacts.telefono,
      email:      contacts.email,
      socialLink: contacts.socialLink,
    })
      .from(contacts)
      .where(and(
        isNull(contacts.archiviatoAt),
        or(
          telefono ? eq(contacts.telefono, telefono) : undefined,
          email ? sql`lower(${contacts.email}) = ${email}` : undefined,
          social ? sql`lower(${contacts.socialLink}) = ${social}` : undefined,
        ),
      ))
      .orderBy(asc(contacts.nome))
      .limit(10),

    db.select({
      id:           students.id,
      firstName:    students.firstName,
      lastName:     students.lastName,
      classe:       students.classe,
      parentPhone:  students.parentPhone,
      studentPhone: students.studentPhone,
      parentEmail:  students.parentEmail,
      studentEmail: students.studentEmail,
    })
      .from(students)
      .where(and(
        eq(students.active, true),
        // Cercando solo per profilo social non c'è niente da confrontare fra gli
        // studenti (là ci sono solo telefoni ed email): la query si ferma subito.
        (coda || email) ? undefined : sql`false`,
        or(
          coda ? sql`${soloCifre(students.parentPhone)} LIKE ${'%' + coda}` : undefined,
          coda ? sql`${soloCifre(students.studentPhone)} LIKE ${'%' + coda}` : undefined,
          email ? sql`lower(${students.parentEmail}) = ${email}` : undefined,
          email ? sql`lower(${students.studentEmail}) = ${email}` : undefined,
        ),
      ))
      .limit(20),
  ])

  const studenti = studentiCandidati
    .filter((s) => {
      if (email && (s.parentEmail?.toLowerCase() === email || s.studentEmail?.toLowerCase() === email)) return true
      if (!telefono) return false
      return normalizzaTelefono(s.parentPhone ?? '') === telefono
        || normalizzaTelefono(s.studentPhone ?? '') === telefono
    })
    .map((s) => ({ id: s.id, nome: `${s.firstName} ${s.lastName}`.trim(), classe: s.classe }))

  return { contatti: contattiTrovati, studenti }
}

// ─────────────────────────────────────────────
// FORM PUBBLICO DEL SITO — /api/contact
// Crea il contatto (o aggiunge solo una riga di diario se lo conosciamo già).
// ─────────────────────────────────────────────

export async function upsertFromPublicRequest(input: {
  requestId: string
  nomeStudente: string
  classeScuola?: string | null
  materie: string
  contatto: string
  note?: string | null
}) {
  const grezzo = (input.contatto ?? '').trim()

  // Il form del sito ha un campo unico "contatto": lo smistiamo nella colonna giusta
  let telefono: string | null = null
  if (sembraTelefono(grezzo)) {
    const normalizzato = normalizzaTelefono(grezzo)
    if (normalizzato && normalizzato.length <= 20) telefono = normalizzato
  }
  const email = !telefono && sembraEmail(grezzo) ? grezzo.toLowerCase().slice(0, 255) : null

  // Né telefono né email: se sembra un profilo social lo salviamo come recapito,
  // così il contatto non resta senza nessun modo per essere richiamato.
  const socialLink = !telefono && !email && sembraSocial(grezzo) ? grezzo.slice(0, 300) : null

  const testoDiario = [
    'Messaggio ricevuto dal sito.',
    `Studente: ${input.nomeStudente}`,
    input.classeScuola ? `Classe/Scuola: ${input.classeScuola}` : null,
    `Materie: ${input.materie}`,
    input.note ? `Note: ${input.note}` : null,
    !telefono && !email && !socialLink ? `Recapito indicato: ${grezzo}` : null,
  ].filter(Boolean).join('\n')

  return await db.transaction(async (tx) => {
    const adesso = new Date()

    let esistente: typeof contacts.$inferSelect | null = null
    if (telefono || email || socialLink) {
      const [trovato] = await tx.select().from(contacts)
        .where(and(
          isNull(contacts.archiviatoAt),
          or(
            telefono ? eq(contacts.telefono, telefono) : undefined,
            email ? sql`lower(${contacts.email}) = ${email}` : undefined,
            socialLink ? sql`lower(${contacts.socialLink}) = ${socialLink.toLowerCase()}` : undefined,
          ),
        ))
        .orderBy(desc(contacts.createdAt))
        .limit(1)
      esistente = trovato ?? null
    }

    let contactId: string

    if (esistente) {
      contactId = esistente.id
      const changes: ContactChanges = { ultimoContattoAt: adesso, updatedAt: adesso }
      // Ci riscrive dopo essere stato archiviato come chiuso: torna in lavorazione
      if (esistente.stato === 'CONVERTITO' || esistente.stato === 'PERSO') {
        changes.stato = 'NUOVO'
        changes.convertitoAt = null
      }
      if (!esistente.contactRequestId) changes.contactRequestId = input.requestId
      await tx.update(contacts).set(changes).where(eq(contacts.id, contactId))
    } else {
      const [creato] = await tx.insert(contacts).values({
        tipo:             'DOPOSCUOLA',
        // Referente provvisorio: il form chiede solo il nome dello studente
        nome:             nomeProprio(input.nomeStudente).slice(0, 100),
        telefono,
        email,
        socialLink,
        canaleOrigine:    'SITO_WEB',
        stato:            'NUOVO',
        nomeStudente:     input.nomeStudente.slice(0, 200),
        classeScuola:     input.classeScuola?.slice(0, 200) ?? null,
        materie:          input.materie.slice(0, 500),
        note:             input.note ?? null,
        contactRequestId: input.requestId,
        // Il form pubblico obbliga la presa visione dell'informativa
        privacyInformata: true,
        ultimoContattoAt: adesso,
      }).returning({ id: contacts.id })

      if (!creato) throw new Error('Creazione del contatto non riuscita')
      contactId = creato.id
    }

    await tx.insert(contactInteractions).values({
      contactId,
      tipo:      'MESSAGGIO',
      direzione: 'RICEVUTA',
      canale:    'SITO_WEB',
      note:      testoDiario,
      data:      adesso,
    })

    return { contactId, creato: !esistente }
  })
}
