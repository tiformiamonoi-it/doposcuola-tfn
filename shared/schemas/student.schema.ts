/**
 * shared/schemas/student.schema.ts
 * "La Dogana" per gli Studenti — validazione Zod con messaggi in italiano
 *
 * Questo schema è condiviso tra frontend e backend:
 * - Il browser lo usa per mostrare errori in tempo reale (prima di inviare)
 * - Il server lo usa per bloccare dati sporchi prima di toccare il database
 */

import { z } from 'zod'

// ─────────────────────────────────────────────
// SCHEMA BASE STUDENTE
// ─────────────────────────────────────────────

export const StudentSchema = z.object({
  // Dati anagrafici obbligatori
  firstName: z
    .string({ message: 'Il nome è obbligatorio' })
    .min(1, 'Il nome non può essere vuoto')
    .max(100, 'Il nome non può superare 100 caratteri')
    .trim(),

  lastName: z
    .string({ message: 'Il cognome è obbligatorio' })
    .min(1, 'Il cognome non può essere vuoto')
    .max(100, 'Il cognome non può superare 100 caratteri')
    .trim(),

  // Info scolastiche (opzionali)
  classe: z
    .string()
    .max(50, 'La classe non può superare 50 caratteri')
    .trim()
    .optional()
    .nullable(),

  scuola: z
    .string()
    .max(100, 'Il nome della scuola non può superare 100 caratteri')
    .trim()
    .optional()
    .nullable(),

  // Contatti alunno (opzionali)
  studentPhone: z
    .union([
      z.string().trim().regex(/^[\d\s+\-().]{7,20}$/, 'Numero di telefono non valido'),
      z.literal(''),
      z.null(),
      z.undefined()
    ]).optional(),

  studentEmail: z
    .union([
      z.string().trim().email('Indirizzo email non valido'),
      z.literal(''),
      z.null(),
      z.undefined()
    ]).optional(),

  // Dati genitore per fatturazione (opzionali ma consigliati)
  parentName: z
    .string()
    .max(200, 'Il nome del genitore non può superare 200 caratteri')
    .trim()
    .optional()
    .nullable(),

  parentEmail: z
    .union([
      z.string().trim().email('Indirizzo email non valido'),
      z.literal(''),
      z.null(),
      z.undefined()
    ]).optional(),

  parentPhone: z
    .union([
      z.string().trim().regex(/^[\d\s+\-().]{7,20}$/, 'Numero di telefono non valido'),
      z.literal(''),
      z.null(),
      z.undefined()
    ]).optional(),

  parentIndirizzo: z
    .string()
    .max(300, "L'indirizzo non può superare 300 caratteri")
    .trim()
    .optional()
    .nullable(),

  parentCitta: z
    .string()
    .max(100, 'La città non può superare 100 caratteri')
    .trim()
    .optional()
    .nullable(),

  parentCap: z
    .union([
      z.string().trim().regex(/^\d{5}$/, 'Il CAP deve essere composto da 5 cifre (es: 20100)'),
      z.literal(''),
      z.null(),
      z.undefined()
    ]).optional(),

  parentCF: z
    .union([
      z.string().trim().regex(/^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i, 'Codice Fiscale non valido (deve avere 16 caratteri nel formato corretto)'),
      z.literal(''),
      z.null(),
      z.undefined()
    ]).optional(),

  parentPIva: z
    .union([
      z.string().trim().regex(/^\d{11}$/, 'La Partita IVA deve essere composta da 11 cifre'),
      z.literal(''),
      z.null(),
      z.undefined()
    ]).optional(),

  // Informazioni aggiuntive
  note:            z.string().max(2000, 'Le note non possono superare 2000 caratteri').optional().nullable(),
  bisogniSpeciali: z.string().max(2000, 'Il campo non può superare 2000 caratteri').optional().nullable(),
  active:          z.boolean().default(true),
})

// ─────────────────────────────────────────────
// SCHEMA CREAZIONE (POST /api/students)
// ─────────────────────────────────────────────
export const CreateStudentSchema = StudentSchema

// ─────────────────────────────────────────────
// SCHEMA AGGIORNAMENTO (PUT /api/students/:id)
// Tutti i campi opzionali; i campi con regex/email
// accettano stringa vuota (trattata come "non fornita")
// ─────────────────────────────────────────────
export const UpdateStudentSchema = StudentSchema.partial()

// ─────────────────────────────────────────────
// SCHEMA PARAMETRI QUERY (GET /api/students)
// Filtri che si possono passare nell'URL
// ─────────────────────────────────────────────
export const StudentQuerySchema = z.object({
  search:   z.string().optional(),
  active:   z.enum(['true', 'false']).optional(),
  packageStatus: z.enum(['DA_PAGARE', 'DA_RINNOVARE', 'SCADUTO', 'ATTIVO', 'NESSUNO', 'all']).optional(),
  hideInactive: z.enum(['true', 'false']).optional(),
  // Modalità leggera per tendine/autocomplete: salta join pacchetti e badge di stato
  light:    z.enum(['true', 'false']).optional(),
  classe:   z.string().optional(),
  page:     z.coerce.number().int().positive().default(1),
  limit:    z.coerce.number().int().positive().max(2000).default(20),
  sortBy:   z.enum(['lastName', 'firstName', 'createdAt']).default('lastName'),
  sortDir:  z.enum(['asc', 'desc']).default('asc'),
})

// ─────────────────────────────────────────────
// TIPI TypeScript inferiti dagli schemi
// ─────────────────────────────────────────────
export type CreateStudentInput = z.infer<typeof CreateStudentSchema>
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>
export type StudentQuery       = z.infer<typeof StudentQuerySchema>
