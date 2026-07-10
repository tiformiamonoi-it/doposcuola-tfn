// Invio email transazionali via Brevo (API HTTP, nessuna dipendenza npm).
// Se le chiavi non sono configurate: warn in console e { sent: false } — mai un errore.

interface EmailPayload {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<{ sent: boolean }> {
  const config = useRuntimeConfig()

  if (!config.brevoApiKey || !config.emailFrom) {
    console.warn('[email] Non configurato (NUXT_BREVO_API_KEY / NUXT_EMAIL_FROM mancanti) — email non inviata:', subject)
    return { sent: false }
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
    console.error('[email] Invio fallito:', subject, '→', err?.data?.message ?? err?.message)
    return { sent: false }
  }
}

// ─── Template (italiano semplice, stili inline) ───

function layout(titolo: string, corpo: string): string {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
    <div style="background: #0063A6; color: #fff; padding: 16px 24px; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0; font-size: 18px;">Ti Formiamo Noi</h2>
    </div>
    <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
      <h3 style="margin-top: 0; font-size: 16px;">${titolo}</h3>
      ${corpo}
      <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">
        Questa è un'email automatica del gestionale Ti Formiamo Noi. Per assistenza contatta la segreteria.
      </p>
    </div>
  </div>`
}

export function emailBenvenutoCredenziali(p: { nome: string; email: string; tempPassword: string; cambioObbligatorio?: boolean }): { subject: string; html: string } {
  const config = useRuntimeConfig()
  const loginLink = config.appUrl
    ? `<p><a href="${config.appUrl}/login" style="display:inline-block;background:#0063A6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Accedi ora</a></p>`
    : ''
  const notaPassword = p.cambioObbligatorio
    ? 'Al primo accesso ti verrà chiesto di <strong>scegliere una nuova password</strong>.'
    : 'Ti consigliamo di <strong>cambiare la password</strong> dopo il primo accesso (dal tuo profilo).'
  return {
    subject: 'Le tue credenziali di accesso — Ti Formiamo Noi',
    html: layout(`Ciao ${p.nome}, il tuo account è pronto!`, `
      <p>Ecco le credenziali per accedere:</p>
      <table style="font-size: 14px; margin: 12px 0;">
        <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Email</td><td><strong>${p.email}</strong></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Password temporanea</td><td><strong style="font-family: monospace;">${p.tempPassword}</strong></td></tr>
      </table>
      <p style="font-size: 14px;">${notaPassword}</p>
      ${loginLink}
    `),
  }
}

export function emailAvvisoPacchetto(p: {
  nomeStudente: string
  nomePacchetto: string
  tipoAvviso: 'ore' | 'scadenza'
  oreResiduo?: string
  dataScadenza?: string
}): { subject: string; html: string } {
  const dettaglio = p.tipoAvviso === 'ore'
    ? `<p style="font-size: 14px;">Il pacchetto <strong>${p.nomePacchetto}</strong> di <strong>${p.nomeStudente}</strong> è quasi esaurito: restano <strong>${p.oreResiduo} ore</strong>.</p>`
    : `<p style="font-size: 14px;">Il pacchetto <strong>${p.nomePacchetto}</strong> di <strong>${p.nomeStudente}</strong> scadrà il <strong>${p.dataScadenza}</strong>.</p>`
  return {
    subject: p.tipoAvviso === 'ore'
      ? `Pacchetto di ${p.nomeStudente} in esaurimento — Ti Formiamo Noi`
      : `Pacchetto di ${p.nomeStudente} in scadenza — Ti Formiamo Noi`,
    html: layout('Avviso pacchetto', `
      ${dettaglio}
      <p style="font-size: 14px;">Per continuare le lezioni senza interruzioni, contatta la segreteria per una ricarica o un rinnovo.</p>
    `),
  }
}
