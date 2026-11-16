import { verificaCard } from '../../services/card.service'
import { rateLimitExceeded } from '../../utils/rate-limit'
import { normalizzaCodiceCard } from '#shared/card-studente'

// GET /api/verifica-card/:codice — PUBBLICO (in PUBLIC_API_PREFIXES): lo apre il
// telefono del negoziante che inquadra il QR, senza account.
//
// PRIVACY (regolamento della card, art. 6):
// - esce solo valida sì/no, nome, iniziale del cognome, "valida fino al" e l'ora del controllo,
//   più se la card è di uno studente o di un genitore (tipo);
// - codice inesistente e card sospesa danno la STESSA risposta, senza motivo: da fuori
//   non si capisce se un codice esiste, né perché una card non vale;
// - non si registra chi controlla né quando: nessun log, nessuna riga nel database.
//   L'unica traccia è il contatore anti-raffica, che vive al massimo 10 minuti.
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'sconosciuto'
  // Largo per un negozio vero (anche col wifi condiviso), stretto per chi prova codici a caso
  if (await rateLimitExceeded(`verifica-card:${ip}`, 30, 10 * 60 * 1000)) {
    throw createError({ statusCode: 429, statusMessage: 'Troppi controlli: riprova tra qualche minuto' })
  }

  // Ogni controllo deve rileggere lo stato di adesso: niente copie in cache per strada
  setResponseHeader(event, 'Cache-Control', 'no-store')

  // L'ora la mette il server, in ora italiana: l'orologio del telefono si può spostare
  const controllatoAlle = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date())

  const codice = normalizzaCodiceCard(getRouterParam(event, 'codice') ?? '')
  const card = codice ? await verificaCard(codice) : null
  return card ? { valida: true as const, ...card, controllatoAlle } : { valida: false as const, controllatoAlle }
})
