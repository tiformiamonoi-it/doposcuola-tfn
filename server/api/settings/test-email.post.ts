import { sendEmail, emailProva } from '../../utils/email'

// POST /api/settings/test-email
// Manda una email di prova all'ADMIN CHE HA CLICCATO, e a nessun altro.
//
// PERCHE' il destinatario non si può scegliere: un endpoint che manda posta a un
// indirizzo qualsiasi passato dal browser diventa, di fatto, un servizio per
// spedire email a nome di Ti Formiamo Noi. Qui l'indirizzo lo decide la sessione,
// quindi al massimo ci si manda un messaggio da soli.
//
// /api/settings è già riservato ad ADMIN/SUPER_TUTOR da API_POLICY: qui stringiamo
// ancora ad ADMIN, perché la configurazione della posta è roba da titolare.
//
// Non lancia mai un errore quando la posta non parte: il mancato invio È il
// risultato della prova, e va mostrato con il suo motivo invece che come un
// errore rosso generico del gestionale.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Accesso riservato agli admin' })
  }

  if (!user.email) {
    throw createError({ statusCode: 400, statusMessage: 'Il tuo account non ha un indirizzo email a cui mandare la prova' })
  }

  const esito = await sendEmail({
    to: user.email,
    ...emailProva(new Date()),
  })

  // `ok` dice che la prova è stata eseguita; `sent` dice com'è andata.
  return esito.sent
    ? { ok: true, destinatario: user.email, sent: true }
    : { ok: true, destinatario: user.email, sent: false, motivo: esito.motivo, dettaglio: esito.dettaglio }
})
