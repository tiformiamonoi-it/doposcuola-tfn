/**
 * shared/schemas/payment.schema.ts
 * "La Dogana" per i Pagamenti — validazione Zod con messaggi in italiano
 *
 * MAPPATURA CAMPO CRITICA (Opzione A — ADL-008):
 *   Schema field : fatturaRichiesta  →  DB column: richiedeFattura (payments)
 *   Schema field : fatturaEmessa     →  DB column: fatturaEmessa   (accounting_entries)
 *
 * Il metodoPagamento è volutamente ristretto a CONTANTI/BONIFICO per questo flusso:
 * - getCashFlow() restituirà totali separati Cassa (CONTANTI) vs Banca (BONIFICO)
 * - I pagamenti iniziali sui pacchetti (package.schema.ts) mantengono l'enum completo
 */

import { z } from 'zod'

// ─────────────────────────────────────────────
// ENUM RISTRETTI (solo i due metodi principali del flusso pagamenti)
// ─────────────────────────────────────────────

export const PaymentMethodRestrictedEnum = z.enum(['CONTANTI', 'BONIFICO'], {
  message: "Il metodo di pagamento deve essere 'CONTANTI' o 'BONIFICO'",
})

export const PaymentTypeEnum = z.enum(['ACCONTO', 'SALDO', 'RATA', 'INTEGRAZIONE'], {
  message: 'Tipo pagamento non valido. Scegli tra: Acconto, Saldo, Rata, Integrazione',
})

// ─────────────────────────────────────────────
// SCHEMA CREAZIONE PAGAMENTO (POST /api/payments)
// ─────────────────────────────────────────────

export const CreatePaymentSchema = z.object({
  packageId: z
    .string({ message: "Il pacchetto è obbligatorio" })
    .cuid2("L'ID del pacchetto non è valido"),

  importo: z
    .number({ message: "L'importo è obbligatorio" })
    .positive("L'importo deve essere maggiore di zero")
    .max(99999, "L'importo non può superare € 99.999"),

  tipoPagamento:   PaymentTypeEnum,
  metodoPagamento: PaymentMethodRestrictedEnum,

  dataPagamento: z.coerce
    .date({ message: 'Data di pagamento non valida' })
    .default(() => new Date()),

  // Nota: nel DB la colonna si chiama "richiedeFattura" — il mapping avviene nel service
  fatturaRichiesta: z.boolean().default(false),

  riferimento: z
    .string()
    .max(200, 'Il riferimento non può superare 200 caratteri')
    .optional(),

  note: z.string().max(500, 'Le note non possono superare 500 caratteri').optional(),
})

// ─────────────────────────────────────────────
// SCHEMA AGGIORNAMENTO STATO FATTURA (PUT /api/payments/:id/invoice)
// Usato da toggleInvoiceStatus — aggiorna accounting_entries.fatturaEmessa
// ─────────────────────────────────────────────

export const UpdateInvoiceStatusSchema = z.object({
  fatturaEmessa: z.boolean({
    message: "Il valore 'fattura emessa' è obbligatorio",
  }),
})

// ─────────────────────────────────────────────
// SCHEMA QUERY PAGAMENTI (GET /api/payments)
// ─────────────────────────────────────────────

export const PaymentQuerySchema = z.object({
  packageId:        z.string().cuid2().optional(),
  metodoPagamento:  PaymentMethodRestrictedEnum.optional(),
  fatturaRichiesta: z.enum(['true', 'false']).optional(),
  page:             z.coerce.number().int().positive().default(1),
  limit:            z.coerce.number().int().positive().max(100).default(20),
})

// ─────────────────────────────────────────────
// TIPI TypeScript inferiti dagli schemi
// ─────────────────────────────────────────────

export type CreatePaymentInput       = z.infer<typeof CreatePaymentSchema>
export type UpdateInvoiceStatusInput = z.infer<typeof UpdateInvoiceStatusSchema>
export type PaymentQuery             = z.infer<typeof PaymentQuerySchema>
export type PaymentMethodRestricted  = z.infer<typeof PaymentMethodRestrictedEnum>
