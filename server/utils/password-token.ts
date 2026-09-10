// I LINK "SCEGLI LA TUA PASSWORD".
//
// Il gestionale non manda più password dentro le email (né in chiaro né temporanee):
// manda un link monouso e a tempo. Chi lo apre sceglie da solo la sua password.
//
// Regola d'oro: nel database finisce SOLO l'impronta SHA-256 del token, mai il
// token vero. Se qualcuno leggesse la tabella password_tokens (backup rubato,
// dump per errore) troverebbe stringhe inutilizzabili: dall'impronta non si
// risale al link, quindi non si entra in nessun account.

import { and, eq, isNull, gt, ne } from 'drizzle-orm'
import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db } from '../database/client'
import { users, passwordTokens } from '../database/schema'
import { sendEmail, emailInvitoPassword } from './email'
import type { EsitoInvitoEmail } from '#shared/email'

// Primo accesso: 7 giorni. Le famiglie leggono la posta con calma e la segreteria
// spesso manda il link su WhatsApp qualche giorno dopo aver creato l'account.
export const DURATA_PRIMO_ACCESSO_ORE = 24 * 7

// Recupero password chiesto dall'utente: finestra stretta, 2 ore.
export const DURATA_RECUPERO_ORE = 2

export type ScopoToken = 'PRIMO_ACCESSO' | 'RECUPERO'

/**
 * Esito di un invito: il link c'è SEMPRE, l'email può non essere partita.
 * `motivoEmail` e `dettaglioEmail` ci sono solo in quel caso e servono a
 * spiegare all'admin cosa è andato storto, invece di un generico "non inviata".
 */
export type EsitoInvito = { linkPassword: string } & EsitoInvitoEmail

// Impronta del token. SHA-256 (e non bcrypt) perché il token è già 32 byte
// casuali: non è indovinabile a forza bruta e la ricerca per hash deve restare
// una sola lettura indicizzata.
function impronta(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Password "segnaposto" per un account appena creato: 32 byte casuali, hashati
 * subito e MAI mostrati a nessuno — nemmeno alla segreteria che crea l'account.
 *
 * Perché non lasciare il campo vuoto: la colonna users.password è NOT NULL e,
 * soprattutto, un valore impossibile da indovinare garantisce che finché la
 * persona non usa il link "scegli la tua password" quell'account non è
 * utilizzabile da nessuno. Nessuno la conosce, quindi nessuno può passarla,
 * dimenticarla in una chat o riusarla altrove.
 */
export async function passwordSegnapostoHash(): Promise<string> {
  return await bcrypt.hash(randomBytes(32).toString('base64url'), 10)
}

/**
 * Crea un nuovo link "scegli la tua password" per un account.
 * Invalida tutti i link precedenti ancora aperti dello stesso utente: vale
 * sempre e solo l'ultimo mandato, così un vecchio link finito in una chat
 * dimenticata non resta buono.
 *
 * Restituisce il token in chiaro (che NON viene salvato) e il link completo.
 */
export async function creaLinkPassword(userId: string, scopo: ScopoToken): Promise<{
  token: string
  link: string
  /** false quando appUrl non è configurato: il link è relativo, va completato col dominio */
  linkAssoluto: boolean
  scadeIlGiorno: Date
}> {
  const config = useRuntimeConfig()

  // 32 byte casuali → 43 caratteri sicuri per un URL (niente + / = da codificare)
  const token = randomBytes(32).toString('base64url')
  const ore = scopo === 'PRIMO_ACCESSO' ? DURATA_PRIMO_ACCESSO_ORE : DURATA_RECUPERO_ORE
  const expiresAt = new Date(Date.now() + ore * 60 * 60 * 1000)

  await db.transaction(async (tx) => {
    // Un solo link valido per volta
    await tx.update(passwordTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordTokens.userId, userId), isNull(passwordTokens.usedAt)))

    await tx.insert(passwordTokens).values({
      userId,
      tokenHash: impronta(token),
      scopo,
      expiresAt,
    })
  })

  const base = (config.appUrl ?? '').replace(/\/+$/, '')
  const percorso = `/imposta-password?token=${token}`

  return {
    token,
    // Senza appUrl configurato restituiamo comunque un link relativo: la segreteria
    // lo vede a schermo e può completarlo col dominio (piano B senza email).
    link: base ? `${base}${percorso}` : percorso,
    linkAssoluto: Boolean(base),
    scadeIlGiorno: expiresAt,
  }
}

/**
 * Controlla un link ricevuto. Restituisce l'account collegato solo se il token
 * esiste, non è ancora stato usato e non è scaduto. In ogni altro caso: null.
 */
export async function verificaToken(token: string): Promise<{
  userId: string
  nome: string
  scopo: ScopoToken
} | null> {
  if (!token) return null

  const riga = await db.query.passwordTokens.findFirst({
    where: and(
      eq(passwordTokens.tokenHash, impronta(token)),
      isNull(passwordTokens.usedAt),
      gt(passwordTokens.expiresAt, new Date()),
    ),
    with: {
      user: { columns: { id: true, firstName: true, active: true } },
    },
  })

  if (!riga?.user || !riga.user.active) return null

  return {
    userId: riga.user.id,
    nome: riga.user.firstName,
    scopo: riga.scopo as ScopoToken,
  }
}

/**
 * Consuma il link e imposta la password scelta dall'utente.
 * Tutto dentro una transazione: o cambia la password E il link viene bruciato,
 * oppure non succede niente. Non esiste lo stato intermedio.
 */
export async function consumaToken(token: string, nuovaPassword: string): Promise<{ userId: string }> {
  if (!token) throw new Error('Link non valido')

  const hash = impronta(token)

  return await db.transaction(async (tx) => {
    // Rilettura DENTRO la transazione: se due schede aprono lo stesso link nello
    // stesso momento, solo la prima trova il token ancora aperto.
    const riga = await tx.query.passwordTokens.findFirst({
      where: and(
        eq(passwordTokens.tokenHash, hash),
        isNull(passwordTokens.usedAt),
        gt(passwordTokens.expiresAt, new Date()),
      ),
      columns: { id: true, userId: true },
    })

    if (!riga) throw new Error('Link non valido')

    const adesso = new Date()

    // Brucia questo link…
    const [bruciato] = await tx.update(passwordTokens)
      .set({ usedAt: adesso })
      .where(and(eq(passwordTokens.id, riga.id), isNull(passwordTokens.usedAt)))
      .returning({ id: passwordTokens.id })

    if (!bruciato) throw new Error('Link non valido')

    // …e tutti gli altri ancora aperti dello stesso account
    await tx.update(passwordTokens)
      .set({ usedAt: adesso })
      .where(and(
        eq(passwordTokens.userId, riga.userId),
        isNull(passwordTokens.usedAt),
        ne(passwordTokens.id, riga.id),
      ))

    await tx.update(users)
      .set({
        password: await bcrypt.hash(nuovaPassword, 10),
        // La password se l'è scelta l'utente: non c'è più niente da "cambiare
        // al primo accesso", quindi il gate non deve scattare.
        mustChangePassword: false,
        updatedAt: adesso,
      })
      .where(eq(users.id, riga.userId))

    return { userId: riga.userId }
  })
}

/**
 * Crea il link e prova a mandarlo per email, in un colpo solo.
 * Usato da tutti i punti in cui il gestionale "invita" qualcuno ad entrare
 * (genitore, studente, tutor): un solo posto, un solo comportamento.
 *
 * Restituisce SEMPRE il link, anche quando l'email non parte: è il piano B
 * della segreteria, che lo copia a schermo e lo manda su WhatsApp.
 */
export async function inviaInvitoPassword(
  user: { id: string; email: string; firstName: string },
  scopo: ScopoToken = 'PRIMO_ACCESSO',
): Promise<EsitoInvito> {
  const { link } = await creaLinkPassword(user.id, scopo)
  const esito = await sendEmail({
    to: user.email,
    ...emailInvitoPassword({ nome: user.firstName, link, scopo }),
  })

  // Quando la posta non parte portiamo su anche il PERCHE': la segreteria deve
  // sapere se deve chiamare l'assistenza (posta bloccata) o semplicemente
  // mandare il link a mano.
  return esito.sent
    ? { linkPassword: link, emailInviata: true }
    : { linkPassword: link, emailInviata: false, motivoEmail: esito.motivo, dettaglioEmail: esito.dettaglio }
}

/**
 * Come sopra, partendo dal solo id: manda a un account già esistente un nuovo
 * link "scegli la tua password".
 *
 * ATTENZIONE, scelta voluta: la password attuale NON viene toccata. Se la persona
 * non apre il link non resta chiusa fuori, e un clic per sbaglio della segreteria
 * non blocca nessuno. Per togliere davvero l'accesso si disattiva/elimina
 * l'account, non si cambia la password.
 */
export async function inviaInvitoPasswordAUtente(userId: string): Promise<EsitoInvito & { email: string }> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, firstName: true },
  })
  if (!user) throw new Error('Account non trovato')

  const invito = await inviaInvitoPassword(user)
  return { email: user.email, ...invito }
}
