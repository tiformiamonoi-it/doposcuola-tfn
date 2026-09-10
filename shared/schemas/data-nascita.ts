import { z } from 'zod'
import { giornoCivileValido, oggiISO } from '../giorno-civile'

// LA DATA DI NASCITA, UNA VOLTA SOLA.
//
// Serve identica in tre posti (alunno, tutor, genitore del portale). Negli altri
// schemi il controllo "giorno civile" è ricopiato a mano perché è due righe; qui
// no: ci sono anche i due paletti sotto, e tre copie che col tempo si scostano
// vorrebbero dire che la stessa data passa in un modulo e viene rifiutata in un
// altro. Una definizione sola, importata dai tre schemi.
//
// SEMPRE FACOLTATIVA: di moltissime persone la data di nascita non la sappiamo,
// e non è un motivo per non poterle inserire in anagrafica.

// Nessuno può essere nato domani, e nessuno dei nostri alunni o tutor nel 1800:
// sono i due paletti che intercettano l'anno battuto male ("2926" invece di
// "1926", "2026" invece di "2016"). Senza, l'errore si scopre solo a compleanno
// mancato, cioè mai.
const ANNO_MINIMO = 1900

export const DataNascitaOpz = z
  .union([
    z.literal(''),
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida (formato AAAA-MM-GG)')
      // "2026-02-30" è ben formato ma non esiste: meglio un 422 chiaro che un 500 dal DB
      .refine(giornoCivileValido, 'Data inesistente (controlla giorno e mese)')
      .refine((v) => v <= oggiISO(), 'La data di nascita non può essere nel futuro')
      .refine(
        (v) => Number(v.slice(0, 4)) >= ANNO_MINIMO,
        `Anno di nascita troppo lontano (dal ${ANNO_MINIMO} in poi)`,
      ),
  ])
  // Il campo vuoto del modulo è "non lo so", non una stringa vuota da salvare:
  // a database ci va NULL, così le ricerche "chi ha la data di nascita" tornano giuste.
  .transform((v) => (v.length > 0 ? v : null))
  .nullish()
