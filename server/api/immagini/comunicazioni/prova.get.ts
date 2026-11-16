import { immagineProva } from '../../../services/comunicazioni.service'
import { rispondiConImmagine } from '../../../utils/immagine-pubblica'

// GET /api/immagini/comunicazioni/prova?v=… — la foto dell'ultima "Invia una prova a me".
// Un posto solo, sovrascritto a ogni prova (vedi CHIAVE_FOTO_PROVA in comunicazioni.service.ts);
// il ?v= nell'email cambia a ogni prova, così non si vede la copia vecchia dalla cache.
export default defineEventHandler(async (event) => rispondiConImmagine(event, await immagineProva()))
