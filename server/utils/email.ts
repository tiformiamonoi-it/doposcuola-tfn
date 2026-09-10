// Invio email transazionali via Brevo (API HTTP, nessuna dipendenza npm).
// Non lancia mai un errore: un'email che non parte non deve far fallire la
// creazione di un account o il salvataggio di una scheda.
//
// PERCHE' l'esito non è più un semplice booleano: quando la posta non parte la
// segreteria vedeva sempre lo stesso messaggio ("servizio non attivo") e doveva
// tirare a indovinare. Le cause vere però sono tre e si risolvono in modi
// diversi: chiavi non configurate (NON_CONFIGURATO), Brevo che rifiuta l'invio —
// account bloccato, mittente non verificato, IP non autorizzato (RIFIUTATO),
// oppure il server che non riesce proprio a raggiungere Brevo (RETE).
// Chi chiama può così dire all'admin cosa è successo davvero.

interface EmailPayload {
  to: string
  subject: string
  html: string
}

// Il vocabolario dei motivi vive in shared/: lo stesso elenco serve al server
// (che decide) e alle pagine (che scelgono la frase da mostrare). Definirlo due
// volte significherebbe, prima o poi, aggiungerne uno solo da una parte.
export type { MotivoEmail } from '#shared/email'
import type { MotivoEmail } from '#shared/email'

/** Esito di un invio: o è partita, o si sa perché no. */
export type EsitoEmail =
  | { sent: true }
  | { sent: false; motivo: MotivoEmail; dettaglio?: string }

// Il `dettaglio` finisce sotto gli occhi di un admin dentro il gestionale: deve
// essere una riga corta e leggibile, mai un dump tecnico.
//
// E soprattutto non deve MAI contenere la chiave API, nemmeno un pezzo: alcuni
// servizi la ripetono dentro il messaggio d'errore. Qui la cancelliamo prima che
// finisca in una risposta HTTP o nei log del server, dove resterebbe scritta.
function dettaglioLeggibile(testo: unknown, chiave: string): string | undefined {
  if (typeof testo !== 'string') return undefined

  let pulito = testo.replace(/\s+/g, ' ').trim()
  if (!pulito) return undefined

  if (chiave) pulito = pulito.split(chiave).join('***')
  // Rete di sicurezza: qualunque stringa con la forma di una chiave Brevo sparisce,
  // anche se non è quella configurata adesso (chiave vecchia, troncata, di prova).
  pulito = pulito.replace(/xkeysib-[A-Za-z0-9._-]+/gi, '***')

  return pulito.length > 200 ? `${pulito.slice(0, 197)}…` : pulito
}

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<EsitoEmail> {
  const config = useRuntimeConfig()

  if (!config.brevoApiKey || !config.emailFrom) {
    const mancante = !config.brevoApiKey ? 'la chiave API di Brevo' : 'l\'indirizzo mittente'
    console.warn('[email] Non configurato (NUXT_BREVO_API_KEY / NUXT_EMAIL_FROM mancanti) — email non inviata:', subject)
    return { sent: false, motivo: 'NON_CONFIGURATO', dettaglio: `Manca ${mancante}` }
  }

  try {
    await $fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': config.brevoApiKey, 'content-type': 'application/json' },
      body: {
        sender: { email: config.emailFrom, name: config.emailFromName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
    })
    return { sent: true }
  } catch (err: any) {
    // Brevo ha risposto (c'è uno stato HTTP) → ha RIFIUTATO l'invio e di solito
    // spiega anche perché. Se invece non c'è nessuna risposta la richiesta non è
    // mai arrivata a destinazione: timeout, DNS, rete del server.
    const stato: number | undefined = err?.response?.status ?? err?.status ?? err?.statusCode
    const chiave = String(config.brevoApiKey ?? '')

    if (typeof stato === 'number') {
      const spiegazione = dettaglioLeggibile(err?.data?.message, chiave)
      const dettaglio = spiegazione ? `${spiegazione} (codice ${stato})` : `codice ${stato}`
      console.error('[email] Invio rifiutato da Brevo:', subject, '→', dettaglio)
      return { sent: false, motivo: 'RIFIUTATO', dettaglio }
    }

    const dettaglio = dettaglioLeggibile(err?.message, chiave)
    console.error('[email] Servizio di posta irraggiungibile:', subject, '→', dettaglio ?? 'causa sconosciuta')
    return { sent: false, motivo: 'RETE', dettaglio }
  }
}

// ─── Template (italiano semplice, stili inline) ───

function layout(titolo: string, corpo: string): string {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
    <div style="background: #0063A6; color: #fff; padding: 16px 24px; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0; font-size: 18px;">tiformiamonoi</h2>
    </div>
    <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
      <h3 style="margin-top: 0; font-size: 16px;">${titolo}</h3>
      ${corpo}
      <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">
        Questa è un'email automatica del gestionale di tiformiamonoi. Per assistenza contatta la segreteria.
      </p>
    </div>
  </div>`
}

// EMAIL DI PROVA (pulsante "Prova invio email" in Impostazioni).
//
// PERCHE' esiste: finora l'unico modo per sapere se la posta funzionava era
// creare un account vero e sperare che arrivasse qualcosa. Con questa l'admin
// verifica in dieci secondi, su sé stesso, senza disturbare nessuna famiglia.
// Data e ora servono a distinguere la prova appena fatta da una vecchia rimasta
// in casella.
export function emailProva(quando: Date): { subject: string; html: string } {
  const dataOra = quando.toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Rome',
  })

  return {
    subject: 'Prova invio — tiformiamonoi',
    html: layout('Prova di invio', `
      <p style="font-size: 14px;">
        Se stai leggendo questo messaggio la posta del gestionale funziona: le email a tutor e famiglie partono regolarmente.
      </p>
      <p style="font-size: 13px; color: #64748b;">Prova richiesta il ${dataOra}.</p>
    `),
  }
}

// INVITO A SCEGLIERE LA PASSWORD — il template che ha sostituito l'email
// "ecco le tue credenziali".
//
// PERCHE': un'email che contiene una password in chiaro è il pattern tipico del
// phishing. I filtri antifrode dei provider di posta la penalizzano (Brevo ci ha
// bloccato l'API proprio per questo) e, soprattutto, è una pessima pratica: la
// password resterebbe per sempre leggibile nella casella di posta della famiglia.
// Qui viaggia solo un link monouso e a tempo: la password se la sceglie l'utente.
export function emailInvitoPassword(p: { nome: string; link: string; scopo: 'PRIMO_ACCESSO' | 'RECUPERO' }): { subject: string; html: string } {
  const primoAccesso = p.scopo === 'PRIMO_ACCESSO'

  const titolo = primoAccesso
    ? `Ciao ${p.nome}, attiva il tuo accesso`
    : `Ciao ${p.nome}, reimposta la tua password`

  const spiegazione = primoAccesso
    ? 'Il tuo account è pronto. Ti manca solo un passaggio: scegliere la password con cui entrerai.'
    : 'Hai chiesto di reimpostare la password. Clicca il pulsante qui sotto e scegline una nuova.'

  const validita = primoAccesso
    ? 'Il link vale <strong>7 giorni</strong> e funziona <strong>una volta sola</strong>.'
    : 'Il link vale <strong>2 ore</strong> e funziona <strong>una volta sola</strong>.'

  return {
    subject: primoAccesso
      ? 'Attiva il tuo accesso — tiformiamonoi'
      : 'Reimposta la tua password — tiformiamonoi',
    html: layout(titolo, `
      <p style="font-size: 14px;">${spiegazione}</p>
      <p style="margin: 20px 0;">
        <a href="${p.link}" style="display:inline-block;background:#0063A6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          ${primoAccesso ? 'Scegli la tua password' : 'Scegli una nuova password'}
        </a>
      </p>
      <p style="font-size: 13px; color: #64748b;">${validita}</p>
      <p style="font-size: 13px; color: #64748b;">
        Se il pulsante non funziona, copia e incolla questo indirizzo nel browser:<br>
        <span style="word-break: break-all;">${p.link}</span>
      </p>
      <p style="font-size: 13px; color: #64748b; margin-top: 16px;">
        Se non hai richiesto tu questa email, ignorala: nessuna modifica verrà fatta al tuo account.
      </p>
    `),
  }
}

// NB: l'avviso "ore" NON indica quante ore restano. Il conteggio residuo è un dato
// che il portale non mostra alla famiglia (vedi getPortalStudents): dirlo per email
// aggirerebbe la stessa riservatezza. Il numero esatto lo comunica la segreteria.
export function emailAvvisoPacchetto(p: {
  nomeStudente: string
  nomePacchetto: string
  tipoAvviso: 'ore' | 'scadenza'
  dataScadenza?: string
}): { subject: string; html: string } {
  const dettaglio = p.tipoAvviso === 'ore'
    ? `<p style="font-size: 14px;">Il pacchetto <strong>${p.nomePacchetto}</strong> di <strong>${p.nomeStudente}</strong> sta per esaurirsi.</p>`
    : `<p style="font-size: 14px;">Il pacchetto <strong>${p.nomePacchetto}</strong> di <strong>${p.nomeStudente}</strong> scadrà il <strong>${p.dataScadenza}</strong>.</p>`
  return {
    subject: p.tipoAvviso === 'ore'
      ? `Pacchetto di ${p.nomeStudente} in esaurimento — tiformiamonoi`
      : `Pacchetto di ${p.nomeStudente} in scadenza — tiformiamonoi`,
    html: layout('Avviso pacchetto', `
      ${dettaglio}
      <p style="font-size: 14px;">Per continuare le lezioni senza interruzioni, contatta la segreteria per una ricarica o un rinnovo.</p>
    `),
  }
}
