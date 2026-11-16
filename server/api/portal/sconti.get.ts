import { convenzioniValide } from '../../services/convenzioni.service'
import { oggiRomeStr } from '../../utils/tutor-time-window'

// GET /api/portal/sconti — Convenzioni con le attività partner (cartolibrerie, palestre…)
// mostrate alle famiglie. Configurate dall'admin in Impostazioni → Sconti.
// Quelle con "valida fino al" già passato (giorno italiano) spariscono da sole: le
// toglie il server, così una convenzione finita non arriva nemmeno nel browser.
// Le foto non sono qui dentro: ognuna ha il suo indirizzo (campo `foto`).
export default defineEventHandler(async () => await convenzioniValide(oggiRomeStr()))
