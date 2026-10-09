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
import { comunicazioni, comunicazioniDestinatari, consensi, studentParents, students, users } from '../database/schema'
import { sendEmail, emailComunicazione } from '../utils/email'
import type { ComunicazioneInput, ComunicazioneTipo } from '#shared/schemas/comunicazione.schema'

// Quante email partono insieme. Una alla volta, 150 famiglie farebbero aspettare la
// segreteria troppo a lungo; tutte insieme, Brevo potrebbe rispondere "piano".
// Cinque è il compromesso: ~150 email in una ventina di secondi.
const EMAIL_IN_PARALLELO = 5

/**
 * I genitori che riceverebbero una comunicazione di questo tipo, adesso.
 * Genitore = account GENITORE attivo, collegato ad almeno un alunno ATTIVO.
 */
async function destinatariPer(tipo: ComunicazioneTipo): Promise<{ id: string; email: string }[]> {
  const condizioni = [
    eq(users.role, 'GENITORE'),
    eq(users.active, true),
    eq(students.active, true),
  ]

  // Il consenso che conta è l'ULTIMA riga MARKETING della persona: se ha detto sì
  // e poi revocato, vale il no. Nessuna riga = non ha mai risposto = niente promozioni.
  if (tipo === 'PROMOZIONALE') {
    condizioni.push(sql`(
      select ${consensi.valore} from ${consensi}
      where ${consensi.tipo} = 'MARKETING' and ${consensi.userId} = ${users.id}
      order by ${consensi.createdAt} desc
      limit 1
    ) is true`)
  }

  // DISTINCT: una mamma con due figli è UNA famiglia, riceve una comunicazione sola
  return await db.selectDistinct({ id: users.id, email: users.email })
    .from(users)
    .innerJoin(studentParents, eq(studentParents.parentUserId, users.id))
    .innerJoin(students, eq(students.id, studentParents.studentId))
    .where(and(...condizioni))
}

/** "La riceveranno N famiglie": il numero che la pagina mostra prima dell'invio */
export async function contaDestinatari(tipo: ComunicazioneTipo): Promise<number> {
  return (await destinatariPer(tipo)).length
}

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
 */
async function spedisci(
  c: { titolo: string; testo: string; tipo: ComunicazioneTipo },
  righe: { rigaId: string; email: string }[],
): Promise<{ inviate: number; nonPartite: number }> {
  const contenuto = emailComunicazione({ titolo: c.titolo, testo: c.testo, tipo: c.tipo, base: baseUrl() })
  let inviate = 0
  let nonPartite = 0

  await aGruppi(righe, EMAIL_IN_PARALLELO, async (r) => {
    try {
      const esito = await sendEmail({ to: r.email, ...contenuto })
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

  return { inviate, nonPartite }
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

  const righe = await db.transaction(async (tx) => {
    const [c] = await tx.insert(comunicazioni)
      .values({ titolo: input.titolo, testo: input.testo, tipo: input.tipo, authorId })
      .returning({ id: comunicazioni.id })
    return await tx.insert(comunicazioniDestinatari)
      .values(elenco.map((u) => ({ comunicazioneId: c!.id, userId: u.id })))
      .returning({ id: comunicazioniDestinatari.id, userId: comunicazioniDestinatari.userId })
  })

  const emailDi = new Map(elenco.map((u) => [u.id, u.email]))
  const esito = await spedisci(input, righe.map((r) => ({ rigaId: r.id, email: emailDi.get(r.userId)! })))

  return { destinatari: elenco.length, ...esito }
}

/** "Invia una prova a me": solo all'email di chi la sta scrivendo. Non salva niente. */
export async function inviaProva(input: ComunicazioneInput, userId: string) {
  const [io] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
  if (!io) throw new Error('Utente non trovato')

  const esito = await sendEmail({
    to: io.email,
    ...emailComunicazione({ ...input, base: baseUrl(), prova: true }),
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
  const righe = await db.select({ rigaId: comunicazioniDestinatari.id, email: users.email })
    .from(comunicazioniDestinatari)
    .innerJoin(users, eq(users.id, comunicazioniDestinatari.userId))
    .where(and(
      eq(comunicazioniDestinatari.comunicazioneId, comunicazioneId),
      isNull(comunicazioniDestinatari.emailInviataAt),
      eq(users.active, true),
    ))

  return await spedisci(c, righe)
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
    createdAt:    comunicazioni.createdAt,
    eliminataAt:  comunicazioni.eliminataAt,
    autoreNome:   users.firstName,
    autoreCognome: users.lastName,
    destinatari:  count(comunicazioniDestinatari.id),
    lette:        count(comunicazioniDestinatari.lettaAt),
    emailInviate: count(comunicazioniDestinatari.emailInviataAt),
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
