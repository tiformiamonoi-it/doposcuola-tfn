// server/services/comunicazioni.service.ts
//
// COMUNICAZIONI A TUTTE LE FAMIGLIE (blocco 3 del piano di ottobre, decisioni D4 e D5).
//
// La segreteria scrive una volta; ogni genitore CON L'ACCOUNT DEL PORTALE la trova
// nel portale e per email. Chi non ha l'account non riceve niente (D4), gli account
// STUDENTE nemmeno. Firma sempre "Segreteria" (D5).
//
// INFORMATIVA va a tutti; PROMOZIONALE solo a chi ha il consenso marketing ATTIVO
// in questo momento (l'ultima riga del registro dei consensi, vedi schema/consensi.ts).

import { and, count, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { comunicazioni, comunicazioniDestinatari, consensi, studentParents, students, systemConfigs, users } from '../database/schema'
import { randomUUID } from 'node:crypto'
import { sendEmail, emailComunicazione, notificaInvioDiMassa } from '../utils/email'
import type { ComunicazioneInput, ComunicazioneTipo } from '#shared/schemas/comunicazione.schema'

// Quante email partono insieme. Una alla volta, 150 famiglie farebbero aspettare la
// segreteria troppo a lungo; tutte insieme, Brevo potrebbe rispondere "piano".
// Cinque è il compromesso: ~150 email in una ventina di secondi.
const EMAIL_IN_PARALLELO = 5

/**
 * Il consenso che conta è l'ULTIMA riga MARKETING della persona: se ha detto sì
 * e poi revocato, vale il no. Nessuna riga = non ha mai risposto = niente promozioni.
 * Va usata in una query che ha `users` fra le tabelle.
 */
function consensoMarketingAttivo() {
  return sql`(
    select ${consensi.valore} from ${consensi}
    where ${consensi.tipo} = 'MARKETING' and ${consensi.userId} = ${users.id}
    order by ${consensi.createdAt} desc
    limit 1
  ) is true`
}

/**
 * I genitori che riceverebbero una comunicazione di questo tipo, adesso.
 * Genitore = account GENITORE attivo, collegato ad almeno un alunno ATTIVO.
 */
async function destinatariPer(tipo: ComunicazioneTipo): Promise<{ id: string; email: string; nome: string }[]> {
  const condizioni = [
    eq(users.role, 'GENITORE'),
    eq(users.active, true),
    eq(students.active, true),
  ]

  if (tipo === 'PROMOZIONALE') condizioni.push(consensoMarketingAttivo())

  // DISTINCT: una mamma con due figli è UNA famiglia, riceve una comunicazione sola
  return await db.selectDistinct({ id: users.id, email: users.email, nome: nomeUtente })
    .from(users)
    .innerJoin(studentParents, eq(studentParents.parentUserId, users.id))
    .innerJoin(students, eq(students.id, studentParents.studentId))
    .where(and(...condizioni))
}

/** "La riceveranno N famiglie": il numero che la pagina mostra prima dell'invio */
export async function contaDestinatari(tipo: ComunicazioneTipo): Promise<number> {
  return (await destinatariPer(tipo)).length
}

/** "Mario Rossi": serve solo al registro delle email, non viaggia nell'email */
const nomeUtente = sql<string>`${users.firstName} || ' ' || ${users.lastName}`

function baseUrl(): string | undefined {
  const base = (useRuntimeConfig().appUrl ?? '').replace(/\/+$/, '')
  return base || undefined
}

/** Fa girare `fn` su tutta la lista, al massimo `quanti` alla volta */
async function aGruppi<T>(lista: T[], quanti: number, fn: (x: T) => Promise<void>) {
  let prossimo = 0
  const lavoratori = Array.from({ length: Math.min(quanti, lista.length) }, async () => {
    while (prossimo < lista.length) await fn(lista[prossimo++]!)
  })
  await Promise.all(lavoratori)
}

/**
 * Spedisce l'email a ciascuna riga e segna sulla riga com'è andata.
 * Un'email che non parte non ferma le altre: si registra il motivo e si va avanti.
 *
 * Con le email delle comunicazioni spente in Impostazioni la comunicazione resta
 * nel portale come sempre; le righe si segnano DISATTIVATO e `spente` lo conta,
 * così la pagina può dire "invio email spento" invece di "non partite" e basta.
 */
async function spedisci(
  c: { id: string; titolo: string; testo: string; tipo: ComunicazioneTipo; conImmagine: boolean },
  righe: { rigaId: string; email: string; nome?: string }[],
): Promise<{ inviate: number; nonPartite: number; spente: number }> {
  const contenuto = emailComunicazione({
    titolo: c.titolo, testo: c.testo, tipo: c.tipo, base: baseUrl(),
    fotoPercorso: c.conImmagine ? `/api/immagini/comunicazioni/${c.id}` : undefined,
  })
  // Un invio = un gruppo nel registro email e una sola notifica alla fine
  const invioId = randomUUID()
  let inviate = 0
  let nonPartite = 0
  let spente = 0

  await aGruppi(righe, EMAIL_IN_PARALLELO, async (r) => {
    try {
      const esito = await sendEmail({ to: r.email, tipo: 'COMUNICAZIONE', nomeDestinatario: r.nome, invioId, ...contenuto })
      if (!esito.sent && esito.motivo === 'DISATTIVATO') spente++
      if (esito.sent) {
        inviate++
        await db.update(comunicazioniDestinatari)
          .set({ emailInviataAt: new Date(), emailErrore: null })
          .where(eq(comunicazioniDestinatari.id, r.rigaId))
      } else {
        nonPartite++
        await db.update(comunicazioniDestinatari)
          .set({ emailErrore: esito.dettaglio ? `${esito.motivo}: ${esito.dettaglio}` : esito.motivo })
          .where(eq(comunicazioniDestinatari.id, r.rigaId))
      }
    } catch (err) {
      // sendEmail non lancia mai: qui finisce solo un guasto imprevisto (database).
      // La riga resta "non partita" e "Riprova" ci ripasserà sopra.
      nonPartite++
      console.error('[comunicazioni] Invio non riuscito a', r.email, err)
    }
  })

  await notificaInvioDiMassa(invioId, `Comunicazione «${c.titolo}»`)
  return { inviate, nonPartite, spente }
}

/**
 * Invia davvero: salva la comunicazione e la fotografia dei destinatari in un colpo
 * solo (o tutto o niente), poi spedisce le email.
 */
export async function inviaComunicazione(input: ComunicazioneInput, authorId: string) {
  const elenco = await destinatariPer(input.tipo)
  if (elenco.length === 0) {
    throw new Error('Nessuna famiglia riceverebbe questa comunicazione: non è stata inviata')
  }

  const { id, righe } = await db.transaction(async (tx) => {
    const [c] = await tx.insert(comunicazioni)
      .values({ titolo: input.titolo, testo: input.testo, tipo: input.tipo, immagine: input.immagine || null, authorId })
      .returning({ id: comunicazioni.id })
    const righe = await tx.insert(comunicazioniDestinatari)
      .values(elenco.map((u) => ({ comunicazioneId: c!.id, userId: u.id })))
      .returning({ id: comunicazioniDestinatari.id, userId: comunicazioniDestinatari.userId })
    return { id: c!.id, righe }
  })

  const persona = new Map(elenco.map((u) => [u.id, u]))
  const esito = await spedisci({ ...input, id, conImmagine: !!input.immagine }, righe.map((r) => ({ rigaId: r.id, email: persona.get(r.userId)!.email, nome: persona.get(r.userId)!.nome })))

  return { destinatari: elenco.length, ...esito }
}

// LA FOTO DELLA PROVA, in un posto solo che ogni prova sovrascrive (system_configs).
// L'email mostra le foto da un indirizzo del gestionale, e la prova non salva nessuna
// comunicazione: senza questo posto non avrebbe un indirizzo da dare alla foto. Niente
// comunicazioni "finte" nello storico. La serve /api/immagini/comunicazioni/prova.
export const CHIAVE_FOTO_PROVA = 'comunicazione_prova_immagine'

/** La foto dell'ultima prova, per l'indirizzo pubblico; null se non c'è o non è una foto valida */
export async function immagineProva(): Promise<string | null> {
  const [r] = await db.select({ value: systemConfigs.value }).from(systemConfigs).where(eq(systemConfigs.key, CHIAVE_FOTO_PROVA)).limit(1)
  return r?.value || null
}

/**
 * "Invia una prova a me": solo all'email di chi la sta scrivendo. Non salva la
 * comunicazione; salva soltanto la foto, se c'è, nel posto della prova (qui sopra),
 * così l'email di prova è identica a quella vera, foto compresa.
 */
export async function inviaProva(input: ComunicazioneInput, userId: string) {
  const [io] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
  if (!io) throw new Error('Utente non trovato')

  let fotoPercorso: string | undefined
  if (input.immagine) {
    await db.insert(systemConfigs).values({ key: CHIAVE_FOTO_PROVA, value: input.immagine })
      .onConflictDoUpdate({ target: systemConfigs.key, set: { value: input.immagine, updatedAt: new Date() } })
    // ?v= cambia a ogni prova: il programma di posta non riusa la foto della prova precedente
    fotoPercorso = `/api/immagini/comunicazioni/prova?v=${Date.now()}`
  }

  const esito = await sendEmail({
    to: io.email,
    tipo: 'COMUNICAZIONE_PROVA',
    ...emailComunicazione({ ...input, base: baseUrl(), prova: true, fotoPercorso }),
  })
  return { email: io.email, ...esito }
}

/** Riprova le email non partite (comprese quelle mai tentate, se l'invio si era interrotto) */
export async function riprovaEmail(comunicazioneId: string) {
  const [c] = await db.select().from(comunicazioni).where(eq(comunicazioni.id, comunicazioneId)).limit(1)
  if (!c) throw new Error('Comunicazione non trovata')
  if (c.eliminataAt) throw new Error('La comunicazione è stata eliminata: non si possono più mandare email')

  // Solo verso account ancora attivi: un genitore disattivato nel frattempo non
  // deve ricevere niente.
  const righe = await db.select({ rigaId: comunicazioniDestinatari.id, email: users.email, nome: nomeUtente })
    .from(comunicazioniDestinatari)
    .innerJoin(users, eq(users.id, comunicazioniDestinatari.userId))
    .where(and(
      eq(comunicazioniDestinatari.comunicazioneId, comunicazioneId),
      isNull(comunicazioniDestinatari.emailInviataAt),
      eq(users.active, true),
      // PROMOZIONALE: il consenso si ricontrolla ADESSO, non vale quello del primo
      // invio. Chi l'ha revocato nel frattempo non deve ricevere l'email.
      ...(c.tipo === 'PROMOZIONALE' ? [consensoMarketingAttivo()] : []),
    ))

  return await spedisci({ ...c, conImmagine: !!c.immagine }, righe)
}

/**
 * La foto di una comunicazione, per l'indirizzo pubblico /api/immagini/comunicazioni/<id>
 * (lo usano le email, che non possono portarsi dietro la foto, e il portale).
 * null se la comunicazione non c'è, è stata eliminata o non ha foto: così, eliminandola,
 * la foto sparisce anche dalle email già arrivate.
 */
export async function immagineComunicazione(id: string): Promise<string | null> {
  const [c] = await db.select({ immagine: comunicazioni.immagine }).from(comunicazioni)
    .where(and(eq(comunicazioni.id, id), isNull(comunicazioni.eliminataAt))).limit(1)
  return c?.immagine ?? null
}

/** Toglie la comunicazione dai portali. Le email già partite restano dove sono. */
export async function eliminaComunicazione(comunicazioneId: string) {
  const [c] = await db.update(comunicazioni)
    .set({ eliminataAt: new Date() })
    .where(and(eq(comunicazioni.id, comunicazioneId), isNull(comunicazioni.eliminataAt)))
    .returning({ id: comunicazioni.id })
  if (!c) throw new Error('Comunicazione non trovata o già eliminata')
  return { ok: true }
}

/** Lo storico per la segreteria, dalla più recente, con i conteggi */
export async function storicoComunicazioni() {
  const righe = await db.select({
    id:           comunicazioni.id,
    titolo:       comunicazioni.titolo,
    testo:        comunicazioni.testo,
    tipo:         comunicazioni.tipo,
    // Solo "c'è o non c'è": la foto la pagina la prende dal suo indirizzo, non dentro l'elenco
    conImmagine:  sql<boolean>`${comunicazioni.immagine} is not null`,
    createdAt:    comunicazioni.createdAt,
    eliminataAt:  comunicazioni.eliminataAt,
    autoreNome:   users.firstName,
    autoreCognome: users.lastName,
    destinatari:  count(comunicazioniDestinatari.id),
    lette:        count(comunicazioniDestinatari.lettaAt),
    emailInviate: count(comunicazioniDestinatari.emailInviataAt),
    // Le non partite perché le email delle comunicazioni erano spente (non un guasto)
    emailSpente:  sql<number>`count(*) filter (where ${comunicazioniDestinatari.emailErrore} = 'DISATTIVATO')`.mapWith(Number),
  })
    .from(comunicazioni)
    .leftJoin(users, eq(users.id, comunicazioni.authorId))
    .leftJoin(comunicazioniDestinatari, eq(comunicazioniDestinatari.comunicazioneId, comunicazioni.id))
    .groupBy(comunicazioni.id, users.firstName, users.lastName)
    .orderBy(desc(comunicazioni.createdAt))

  return righe.map(({ autoreNome, autoreCognome, ...r }) => ({
    ...r,
    // Il nome vero serve solo qui, in segreteria: alle famiglie arriva "Segreteria"
    autore: `${autoreNome ?? ''} ${autoreCognome ?? ''}`.trim() || null,
    emailNonPartite: r.destinatari - r.emailInviate,
  }))
}

// ─── Portale (solo GENITORE) ───

/** Le comunicazioni ricevute da questo genitore e non eliminate, dalla più recente */
export async function comunicazioniDelGenitore(userId: string) {
  return await db.select({
    id:        comunicazioni.id,
    titolo:    comunicazioni.titolo,
    testo:     comunicazioni.testo,
    // Solo il segno: la foto si scarica dal suo indirizzo, una per volta (vedi immagineComunicazione)
    conImmagine: sql<boolean>`${comunicazioni.immagine} is not null`,
    createdAt: comunicazioni.createdAt,
    lettaAt:   comunicazioniDestinatari.lettaAt,
  })
    .from(comunicazioniDestinatari)
    .innerJoin(comunicazioni, eq(comunicazioni.id, comunicazioniDestinatari.comunicazioneId))
    .where(and(eq(comunicazioniDestinatari.userId, userId), isNull(comunicazioni.eliminataAt)))
    .orderBy(desc(comunicazioni.createdAt))
}

/** Quante comunicazioni non ha ancora visto (si somma al pallino delle note) */
export async function contaComunicazioniNonLette(userId: string): Promise<number> {
  const [row] = await db.select({ n: count() })
    .from(comunicazioniDestinatari)
    .innerJoin(comunicazioni, eq(comunicazioni.id, comunicazioniDestinatari.comunicazioneId))
    .where(and(
      eq(comunicazioniDestinatari.userId, userId),
      isNull(comunicazioniDestinatari.lettaAt),
      isNull(comunicazioni.eliminataAt),
    ))
  return row?.n ?? 0
}

/** Il genitore ha aperto la pagina Comunicazioni: tutte le sue risultano lette */
export async function segnaComunicazioniLette(userId: string) {
  await db.update(comunicazioniDestinatari)
    .set({ lettaAt: new Date() })
    .where(and(eq(comunicazioniDestinatari.userId, userId), isNull(comunicazioniDestinatari.lettaAt)))
}
