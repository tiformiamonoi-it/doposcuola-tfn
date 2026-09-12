import { getBolliDaVersare } from '../../../services/bollo.service'

// GET /api/accounting/bolli
// I bolli incassati e non ancora versati con l'F24: quanti sono, quanto fanno e
// l'elenco (alunno e data), che è quello che si apre cliccando la card in Contabilità.
// L'accesso è già ristretto agli ADMIN da /api/accounting (server/utils/auth-policy.ts).
export default defineEventHandler(async () => {
  return await getBolliDaVersare()
})
