/**
 * shared/schemas/standard-package.schema.ts
 * "La Dogana" per i MODELLI di pacchetto (tabella `standard_packages`)
 *
 * Attenzione a non confondere due cose che si somigliano:
 *   - `package.schema.ts`  → i pacchetti VENDUTI a un alunno (10 ore a Luca Rossi);
 *   - questo file          → i MODELLI del listino (Impostazioni → Pacchetti Standard),
 *     cioè lo stampino da cui si copiano i valori al momento della vendita.
 *
 * Le regole stanno qui, e non dentro i singoli handler, perché creazione (POST) e
 * modifica (PUT) devono accettare ESATTAMENTE gli stessi valori: se domani il prezzo
 * massimo cambia, si tocca una riga sola e le due porte restano d'accordo.
 */

import { z } from 'zod'

// I tre tipi di modello. Sono ripetuti qui invece di essere importati da
// `package.schema.ts` per tenere questo file indipendente: i modelli del listino e i
// pacchetti venduti sono due mondi separati e non devono trascinarsi dietro a vicenda.
const TipoModelloEnum = z.enum(['ORE', 'MENSILE', 'A_CONSUMO'], {
  message: 'Il tipo di pacchetto deve essere ORE, MENSILE o A_CONSUMO',
})

// ─────────────────────────────────────────────
// CREAZIONE MODELLO (POST /api/standard-packages)
// ─────────────────────────────────────────────
// Nota storica: queste regole erano scritte dentro l'handler del POST. Sono state
// spostate qui *identiche*, senza toccarne il comportamento, per poterle riusare nel PUT.
export const CreateStandardPackageSchema = z.object({
  nome:        z.string().min(1).max(200).trim(),
  descrizione: z.string().max(500).optional().nullable(),
  tipo:        TipoModelloEnum,
  categoria:   z.string().min(1).max(100).trim(),
  oreIncluse:        z.number().positive().max(9999),
  giorniInclusi:     z.number().int().positive().max(365).optional().nullable(),
  orarioGiornaliero: z.number().positive().max(24).optional().nullable(),
  prezzoStandard:    z.number().nonnegative().max(99999),
  tariffaOraria:     z.number().positive().max(9999).optional().nullable(),
})

// ─────────────────────────────────────────────
// MODIFICA MODELLO (PUT /api/standard-packages/:id) — solo ADMIN
// ─────────────────────────────────────────────
// Stessi campi, stessi limiti, ma tutti facoltativi: si aggiorna solo ciò che arriva.
// PERCHE' `.partial()` e non uno schema riscritto a mano: così è impossibile che le due
// finestre (crea e modifica) accettino numeri diversi per lo stesso campo.
//
// I campi che nel database possono restare vuoti (giorni, ore al giorno, tariffa oraria)
// accettano anche `null`: serve a ripulirli quando un modello cambia tipo — per esempio
// da MENSILE a ORE i "giorni inclusi" non hanno più senso e vanno svuotati, altrimenti
// resterebbero lì come un numero fantasma che nessuno vede più ma che il database conserva.
export const UpdateStandardPackageSchema = CreateStandardPackageSchema
  .partial()
  // Una PUT senza nemmeno un campo è quasi sempre un errore di chi chiama: meglio dirlo
  // subito con un 422 parlante che scrivere a vuoto e far credere all'utente di aver salvato.
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Nessun campo da aggiornare',
  })

export type CreateStandardPackageInput = z.infer<typeof CreateStandardPackageSchema>
export type UpdateStandardPackageInput = z.infer<typeof UpdateStandardPackageSchema>
