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
    .string()
    .regex(/^[\d\s+\-().]{7,20}$/, 'Numero di telefono non valido')
    .optional()
    .nullable(),

  studentEmail: z
    .string()
    .email('Indirizzo email non valido (manca la @?)')
    .optional()
    .nullable(),

  // Dati genitore per fatturazione (opzionali ma consigliati)
  parentName: z
    .string()
    .max(200, 'Il nome del genitore non può superare 200 caratteri')
    .trim()
    .optional()
    .nullable(),

  parentEmail: z
    .string()
    .email('Indirizzo email genitore non valido')
    .optional()
    .nullable(),

  parentPhone: z
    .string()
    .regex(/^[\d\s+\-().]{7,20}$/, 'Numero di telefono genitore non valido')
    .optional()
    .nullable(),

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
    .string()
    .regex(/^\d{5}$/, 'Il CAP deve essere composto da 5 cifre (es: 20100)')
    .optional()
    .nullable(),

  parentCF: z
    .string()
    .regex(
      /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i,
      'Codice Fiscale non valido (deve avere 16 caratteri nel formato corretto)',
    )
    .optional()
    .nullable(),

  parentPIva: z
    .string()
    .regex(/^\d{11}$/, 'La Partita IVA deve essere composta da 11 cifre')
    .optional()
    .nullable(),

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
export const UpdateStudentSchema = StudentSchema.partial().extend({
  studentPhone: z
    .string()
    .refine(v => !v || /^[\d\s+\-().]{7,20}$/.test(v), 'Numero di telefono non valido')
    .optional().nullable(),

  studentEmail: z
    .string()
    .refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Indirizzo email non valido')
    .optional().nullable(),

  parentPhone: z
    .string()
    .refine(v => !v || /^[\d\s+\-().]{7,20}$/.test(v), 'Numero di telefono genitore non valido')
    .optional().nullable(),

  parentEmail: z
    .string()
    .refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Email genitore non valida')
    .optional().nullable(),

  parentCap: z
    .string()
    .refine(v => !v || /^\d{5}$/.test(v), 'Il CAP deve essere composto da 5 cifre')
    .optional().nullable(),

  parentCF: z
    .string()
    .refine(v => !v || /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i.test(v), 'Codice Fiscale non valido')
    .optional().nullable(),
})

// ─────────────────────────────────────────────
// SCHEMA PARAMETRI QUERY (GET /api/students)
// Filtri che si possono passare nell'URL
// ─────────────────────────────────────────────
export const StudentQuerySchema = z.object({
  search:   z.string().optional(),
  active:   z.enum(['true', 'false']).optional(),
  classe:   z.string().optional(),
  page:     z.coerce.number().int().positive().default(1),
  limit:    z.coerce.number().int().positive().max(100).default(20),
  sortBy:   z.enum(['lastName', 'firstName', 'createdAt']).default('lastName'),
  sortDir:  z.enum(['asc', 'desc']).default('asc'),
})

// ─────────────────────────────────────────────
// TIPI TypeScript inferiti dagli schemi
// ─────────────────────────────────────────────
export type CreateStudentInput = z.infer<typeof CreateStudentSchema>
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>
export type StudentQuery       = z.infer<typeof StudentQuerySchema>
