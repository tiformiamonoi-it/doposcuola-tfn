import { convenzioniValide } from '../../services/convenzioni.service'
import { oggiRomeStr } from '../../utils/tutor-time-window'

// GET /api/tutor/convenzioni — le stesse convenzioni delle famiglie (/api/portal/sconti),
// per l'area tutor: niente convenzioni "solo tutor" per ora (decisione D5). Il dettaglio
// di una convenzione la pagina lo prende da questo stesso elenco, come fa il portale.
// Le foto hanno il loro indirizzo pubblico (/api/immagini/convenzioni/<id>, campo `foto`).
export default defineEventHandler(async () => await convenzioniValide(oggiRomeStr()))
