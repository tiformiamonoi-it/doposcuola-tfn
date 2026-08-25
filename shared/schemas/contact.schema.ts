import { z } from 'zod'
import { normalizzaTelefono } from '../phone'
import {
  VALORI_TIPO_CONTATTO,
  VALORI_CANALE_CONTATTO,
  VALORI_STATO_CONTATTO,
  VALORI_RUOLO_MARKETING,
  VALORI_TIPO_INTERAZIONE,
  VALORI_DIREZIONE_INTERAZIONE,
  VALORI_ESITO_INTERAZIONE,
} from '../contatti'

// Usato dal form pubblico /prenota e ri-validato dal server in /api/contact
export const PublicContactSchema = z.object({
  nomeStudente:  z.string().min(1, { message: 'Nome studente obbligatorio' }).max(200),
  classeScuola:  z.string().max(200).optional(),
  materie:       z.string().min(1, { message: 'Specifica almeno una materia' }).max(500),
  contatto:      z.string().min(1, { message: 'Telefono o email obbligatorio' }).max(200),
  note:          z.string().max(1000).optional(),
  // GDPR art. 13: il form raccoglie dati (anche di minori) → presa visione obbligatoria
  privacyAccettata: z.boolean().refine((v) => v === true, {
    message: "Devi confermare di aver letto l'informativa privacy",
  }),
})

export type PublicContactInput = z.infer<typeof PublicContactSchema>

// ─────────────────────────────────────────────
// MATTONCINI RIUSABILI
// Nota: `.nullish()` sta SEMPRE per ultimo, così una chiave assente resta assente
// (serve alle modifiche parziali: aggiorniamo solo i campi davvero inviati),
// mentre `null` esplicito significa "svuota il campo".
// ─────────────────────────────────────────────

/** Testo facoltativo: '' diventa null, così nel DB non restano stringhe vuote. */
const testoOpz = (max: number, messaggio: string) =>
  z.string().trim().max(max, messaggio).transform((v) => (v.length > 0 ? v : null)).nullish()

/** Telefono facoltativo, salvato sempre normalizzato +39… */
const telefonoOpz = z
  .string()
  .trim()
  .max(30, 'Numero di telefono troppo lungo')
  .transform((v) => normalizzaTelefono(v) || null)
  .refine((v) => v === null || v.length <= 20, { message: 'Numero di telefono non valido' })
  .nullish()

/** Email facoltativa, salvata sempre in minuscolo. */
const emailOpz = z
  .union([
    z.literal(''),
    z.string().trim().toLowerCase().email('Indirizzo email non valido').max(255, 'Email troppo lunga'),
  ])
  .transform((v) => (v.length > 0 ? v : null))
  .nullish()

/** Giorno civile 'YYYY-MM-DD' (mai timestamptz: la data-giorno non ha fuso orario). */
const giornoOpz = z
  .union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida (formato AAAA-MM-GG)')])
  .transform((v) => (v.length > 0 ? v : null))
  .nullish()

// ─────────────────────────────────────────────
// CONTATTO — campi comuni a creazione e modifica
// ─────────────────────────────────────────────
const ContactFieldsSchema = z.object({
  tipo: z.enum(VALORI_TIPO_CONTATTO, { message: 'Tipo di contatto non valido' }),

  nome:    z.string().trim().min(1, 'Il nome è obbligatorio').max(100, 'Il nome non può superare 100 caratteri'),
  cognome: testoOpz(100, 'Il cognome non può superare 100 caratteri'),

  telefono: telefonoOpz,
  email:    emailOpz,

  // ATTENZIONE: qui NIENTE .default() — in Zod 4 il default resta attivo anche dopo
  // .partial(), e una modifica parziale finirebbe per riscrivere fonte/stato/privacy
  // con i valori di partenza. I default valgono solo in creazione (vedi sotto).
  canaleOrigine: z.enum(VALORI_CANALE_CONTATTO, { message: 'Fonte non valida' }),
  stato:         z.enum(VALORI_STATO_CONTATTO, { message: 'Stato non valido' }),

  prossimoRicontatto: giornoOpz,
  note:               testoOpz(2000, 'Le note non possono superare 2000 caratteri'),

  // Solo Doposcuola
  nomeStudente: testoOpz(200, 'Il nome dello studente non può superare 200 caratteri'),
  classeScuola: testoOpz(200, 'Classe/scuola non può superare 200 caratteri'),
  materie:      testoOpz(500, 'Le materie non possono superare 500 caratteri'),

  // Solo Marketing
  azienda:           testoOpz(200, "L'attività/azienda non può superare 200 caratteri"),
  servizioInteresse: testoOpz(200, 'Il servizio di interesse non può superare 200 caratteri'),
  marketingRuolo:    z.enum(VALORI_RUOLO_MARKETING, { message: 'Ruolo non valido' }).nullish(),

  privacyInformata: z.boolean(),
})

// POST /api/contacts — i default si applicano solo qui; almeno un recapito
// (telefono o email) è obbligatorio.
export const CreateContactSchema = ContactFieldsSchema.extend({
  canaleOrigine:    z.enum(VALORI_CANALE_CONTATTO, { message: 'Fonte non valida' }).default('ALTRO'),
  stato:            z.enum(VALORI_STATO_CONTATTO, { message: 'Stato non valido' }).default('NUOVO'),
  privacyInformata: z.boolean().default(false),
}).refine(
  (d) => Boolean(d.telefono) || Boolean(d.email),
  { message: 'Inserisci almeno un telefono o una email', path: ['telefono'] },
)

// PUT /api/contacts/:id — tutti i campi facoltativi (si aggiorna solo ciò che arriva)
export const UpdateContactSchema = ContactFieldsSchema.partial().extend({
  // Collegamento allo studente creato dalla conversione (null = scollega)
  studentId: z.string().trim().min(1).nullish(),
})

// ─────────────────────────────────────────────
// INTERAZIONE (diario) — POST /api/contacts/:id/interactions
// Può aggiornare stato e prossimo ricontatto nella stessa operazione.
// ─────────────────────────────────────────────
export const CreateInteractionSchema = z.object({
  tipo:      z.enum(VALORI_TIPO_INTERAZIONE, { message: 'Tipo di interazione non valido' }),
  direzione: z.enum(VALORI_DIREZIONE_INTERAZIONE, { message: 'Direzione non valida' }),
  canale:    z.enum(VALORI_CANALE_CONTATTO, { message: 'Canale non valido' }),
  esito:     z.enum(VALORI_ESITO_INTERAZIONE, { message: 'Esito non valido' }).nullish(),

  note: testoOpz(2000, 'Le note non possono superare 2000 caratteri'),
  // Data e ora dell'interazione in formato ISO; assente = adesso
  data: z.string().datetime({ offset: true, message: 'Data non valida' }).nullish(),

  // Aggiornamenti facoltativi del contatto, nella stessa transazione
  nuovoStato:         z.enum(VALORI_STATO_CONTATTO, { message: 'Stato non valido' }).nullish(),
  prossimoRicontatto: giornoOpz,
})

// ─────────────────────────────────────────────
// GET /api/contacts — filtri e paginazione
// ─────────────────────────────────────────────

/** Flag che arriva dall'URL come stringa: '1'/'true' = acceso, tutto il resto spento. */
const flagQuery = z
  .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false'), z.literal('')])
  .default('0')
  .transform((v) => v === '1' || v === 'true')

export const ListContactsQuerySchema = z.object({
  tipo:   z.enum(VALORI_TIPO_CONTATTO, { message: 'Tipo di contatto non valido' }).default('DOPOSCUOLA'),
  stato:  z.enum(VALORI_STATO_CONTATTO, { message: 'Stato non valido' }).optional(),
  canale: z.enum(VALORI_CANALE_CONTATTO, { message: 'Fonte non valida' }).optional(),
  search: z.string().trim().max(100).optional(),

  daRicontattare:    flagQuery,
  includiArchiviati: flagQuery,
  // Card "Convertiti nel mese": solo chi è diventato cliente dal 1° del mese a oggi
  convertitiMese:    flagQuery,

  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

// ─────────────────────────────────────────────
// IMPORT DA CSV — POST /api/contacts/import
// Il browser legge il file e manda le righe COSÌ COME SONO (solo testo).
// Qui si controlla solo la forma (testo, non troppe righe insieme): il contenuto
// lo traduce e lo verifica `normalizzaRigaImport` in shared/contatti-import.ts,
// la stessa funzione usata per l'anteprima nel browser.
// ─────────────────────────────────────────────

/** Una cella del file: testo, con un tetto generoso (le note arrivano a 2000). */
const cellaImport = z.string().max(2100, 'Cella troppo lunga').optional()

export const ImportContactsSchema = z.object({
  // Usato quando la colonna "tipo" della riga è vuota: è la scheda aperta
  tipoDefault: z.enum(VALORI_TIPO_CONTATTO, { message: 'Tipo di contatto non valido' }),

  righe: z.array(
    z.object({
      // Numero della riga nel file (intestazione = 1): serve solo nei messaggi
      riga:                z.coerce.number().int().min(1).max(100000).optional(),
      tipo:                cellaImport,
      nome:                cellaImport,
      cognome:             cellaImport,
      telefono:            cellaImport,
      email:               cellaImport,
      fonte:               cellaImport,
      stato:               cellaImport,
      prossimo_ricontatto: cellaImport,
      nome_studente:       cellaImport,
      classe_scuola:       cellaImport,
      materie:             cellaImport,
      azienda:             cellaImport,
      servizio_interesse:  cellaImport,
      ruolo_marketing:     cellaImport,
      note:                cellaImport,
    }),
  )
    .min(1, 'Nessuna riga da importare')
    .max(500, 'Massimo 500 righe per volta'),
})

// GET /api/contacts/duplicati?telefono=&email=
export const DuplicatiQuerySchema = z.object({
  telefono: z.string().trim().max(30).optional(),
  email:    z.string().trim().max(255).optional(),
})

// ─────────────────────────────────────────────
// TIPI TypeScript inferiti dagli schemi
// ─────────────────────────────────────────────
export type CreateContactInput     = z.infer<typeof CreateContactSchema>
export type UpdateContactInput     = z.infer<typeof UpdateContactSchema>
export type CreateInteractionInput = z.infer<typeof CreateInteractionSchema>
export type ListContactsQuery      = z.infer<typeof ListContactsQuerySchema>
export type DuplicatiQuery         = z.infer<typeof DuplicatiQuerySchema>
export type ImportContactsInput    = z.infer<typeof ImportContactsSchema>
