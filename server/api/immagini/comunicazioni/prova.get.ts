import { immagineProva } from '../../../services/comunicazioni.service'
import { rispondiConImmagine } from '../../../utils/immagine-pubblica'

// GET /api/immagini/comunicazioni/prova?k=… — la foto dell'ultima "Invia una prova a me".
// Un posto solo, sovrascritto a ogni prova (vedi CHIAVE_FOTO_PROVA in comunicazioni.service.ts).
// Senza la chiave giusta, scritta solo nell'email di prova, 404: la foto non è ancora uscita.
export default defineEventHandler(async (event) => {
  const k = getQuery(event).k
  return rispondiConImmagine(event, await immagineProva(typeof k === 'string' ? k : ''))
})
