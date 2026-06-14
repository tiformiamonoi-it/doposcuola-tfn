/**
 * shared/schemas/lesson.schema.ts
 * "La Dogana" per le Lezioni — validazione Zod con messaggi in italiano
 *
 * Gestisce la creazione di lezioni con le relative regole:
 *   - Ogni lezione ha 1 tutor, 1 slot orario, 1 data e N studenti (min 1)
 *   - Il tipo (SINGOLA/GRUPPO/MAXI) è calcolato dal numero di studenti
 *   - Il compenso tutor è calcolato automaticamente dal server
 *
 * TARIFFE COMPENSO TUTOR (da lessonCalculations.js — NON modificare senza aggiornare anche il service):
 *   SINGOLA  = € 5,00/ora  (1 studente)
 *   GRUPPO   = € 8,00/ora  (2–4 studenti)
 *   MAXI     = € 8,50/ora  (5+ studenti)
 *   forzaGruppo = paga tariffa GRUPPO anche con 1 studente (casi speciali)
 */

import { z } from 'zod'

// ─────────────────────────────────────────────
// SUB-SCHEMA: singolo studente in una lezione
// ─────────────────────────────────────────────

export const LessonStudentSchema = z.object({
  studentId: z
    .string({ message: "L'ID dello studente è obbligatorio" })
    .cuid2("L'ID dello studente non è valido"),

  packageId: z
    .string({ message: "Il pacchetto da cui scalare le ore è obbligatorio" })
    .cuid2("L'ID del pacchetto non è valido"),
})

// ─────────────────────────────────────────────
// SCHEMA CREAZIONE LEZIONE (POST /api/lessons)
// ─────────────────────────────────────────────

export const CreateLessonSchema = z
  .object({
    tutorId: z
      .string({ message: 'Il tutor è obbligatorio' })
      .cuid2('ID tutor non valido'),

    timeSlotId: z
      .string({ message: "Lo slot orario è obbligatorio" })
      .cuid2('ID slot orario non valido'),

    data: z.coerce.date({
      message: 'La data della lezione non è valida',
    }),

    studenti: z
      .array(LessonStudentSchema, { message: 'Devi selezionare almeno uno studente' })
      .min(1, 'Devi selezionare almeno uno studente')
      .max(10, 'Non puoi aggiungere più di 10 studenti a una lezione'),

    mezzaLezione: z.boolean().default(false),
    forzaGruppo: z.boolean().default(false),

    note: z.string().max(1000, 'Le note non possono superare 1000 caratteri').optional().nullable(),
  })
  .superRefine((data, ctx) => {
    // Controllo duplicati: lo stesso studente non può apparire due volte
    const ids = data.studenti.map((s) => s.studentId)
    const idSet = new Set(ids)
    if (ids.length !== idSet.size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studenti'],
        message: 'Lo stesso studente non può essere aggiunto due volte alla stessa lezione',
      })
    }

    // Controllo: la data non può essere nel futuro lontano (max 1 anno)
    const oggi = new Date()
    const maxDate = new Date(oggi)
    maxDate.setFullYear(maxDate.getFullYear() + 1)
    if (data.data > maxDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['data'],
        message: 'La data della lezione non può essere superiore a 1 anno nel futuro',
      })
    }
  })

// ─────────────────────────────────────────────
// SCHEMA AGGIORNAMENTO LEZIONE (PUT /api/lessons/:id)
// ─────────────────────────────────────────────

export const UpdateLessonSchema = z.object({
  studenti:    z.array(LessonStudentSchema).min(1, 'Devi avere almeno uno studente').optional(),
  forzaGruppo: z.boolean().optional(),
  note:        z.string().max(1000).optional().nullable(),
})

// ─────────────────────────────────────────────
// SCHEMA ELIMINAZIONE BULK (DELETE /api/lessons/bulk/by-tutor-date)
// Elimina tutte le lezioni di un tutor in una data
// ─────────────────────────────────────────────

export const DeleteLessonsBulkSchema = z.object({
  tutorId: z
    .string({ message: 'Il tutor è obbligatorio' })
    .cuid2('ID tutor non valido'),

  data: z
    .string({ message: 'La data è obbligatoria' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La data deve essere nel formato YYYY-MM-DD (es: 2025-11-15)'),
})

// ─────────────────────────────────────────────
// SCHEMA QUERY LEZIONI (GET /api/lessons)
// ─────────────────────────────────────────────

export const LessonQuerySchema = z.object({
  tutorId:     z.string().cuid2().optional(),
  studentId:   z.string().cuid2().optional(),
  dataInizio:  z.coerce.date().optional(),
  dataFine:    z.coerce.date().optional(),
  tipo:        z.enum(['SINGOLA', 'GRUPPO', 'MAXI']).optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().positive().max(1000).default(50),
})

// ─────────────────────────────────────────────
// SCHEMA CALENDARIO (GET /api/lessons/calendar/giorni)
// ─────────────────────────────────────────────

export const CalendarQuerySchema = z.object({
  anno:    z.coerce.number().int().min(2020, 'Anno non valido').max(2099, 'Anno non valido'),
  mese:    z.coerce.number().int().min(1, 'Il mese deve essere tra 1 e 12').max(12, 'Il mese deve essere tra 1 e 12'),
  tutorId: z.string().cuid2().optional(),
})

// ─────────────────────────────────────────────
// SCHEMA CHECK DUPLICATI SLOT (GET /api/lessons/check-duplicate)
// Verifica se uno slot è già occupato da certi studenti
// ─────────────────────────────────────────────

export const CheckDuplicateSchema = z.object({
  tutorId:    z.string().cuid2('ID tutor non valido'),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida (formato YYYY-MM-DD)'),
  timeSlotId: z.string().cuid2('ID slot non valido'),
  studentIds: z.string().optional(), // ID separati da virgola: "id1,id2,id3"
})

// ─────────────────────────────────────────────
// TIPI TypeScript inferiti dagli schemi
// ─────────────────────────────────────────────
export type CreateLessonInput      = z.infer<typeof CreateLessonSchema>
export type UpdateLessonInput      = z.infer<typeof UpdateLessonSchema>
export type DeleteLessonsBulkInput = z.infer<typeof DeleteLessonsBulkSchema>
export type LessonStudentInput     = z.infer<typeof LessonStudentSchema>
export type LessonQuery            = z.infer<typeof LessonQuerySchema>
export type CalendarQuery          = z.infer<typeof CalendarQuerySchema>
export type CheckDuplicateInput    = z.infer<typeof CheckDuplicateSchema>
