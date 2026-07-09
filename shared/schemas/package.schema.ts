/**
 * shared/schemas/package.schema.ts
 * "La Dogana" per i Pacchetti — validazione Zod con messaggi in italiano
 *
 * Gestisce la validazione per la creazione/modifica di pacchetti ore
 * e per la registrazione dei pagamenti.
 *
 * TIPI DI PACCHETTO:
 *   ORE     — Es: "10 ore di ripetizioni". Si scala -1 ora per lezione.
 *   MENSILE — Es: "12 giorni × 3 ore al giorno". Si scala -1 giorno per data.
 */

import { z } from 'zod'
import { PaymentTypeEnum, PaymentMethodEnum } from './payment.schema'

// ─────────────────────────────────────────────
// ENUM CONDIVISI
// ─────────────────────────────────────────────

export const PackageTypeEnum = z.enum(['ORE', 'MENSILE', 'A_CONSUMO'], {
  message: 'Il tipo di pacchetto deve essere ORE, MENSILE o A_CONSUMO',
})

export const PackageStatusEnum = z.enum([
  'ATTIVO',
  'DA_RINNOVARE',
  'SCADUTO',
  'ESAURITO',
  'DA_PAGARE',
  'PAGATO',
  'CHIUSO',
])

// ─────────────────────────────────────────────
// SCHEMA PAGAMENTO INIZIALE (opzionale alla creazione del pacchetto)
// ─────────────────────────────────────────────

export const InitialPaymentSchema = z.object({
  importo: z
    .number({ message: "L'importo è obbligatorio" })
    .positive("L'importo deve essere maggiore di zero"),

  tipoPagamento:   PaymentTypeEnum.default('ACCONTO'),
  metodoPagamento: PaymentMethodEnum,

  dataPagamento:   z.coerce.date().default(() => new Date()),
  richiedeFattura: z.boolean().default(false),
  riferimento:     z.string().max(200, 'Il riferimento non può superare 200 caratteri').optional(),
  note:            z.string().max(500, 'Le note non possono superare 500 caratteri').optional(),
})

// ─────────────────────────────────────────────
// SCHEMA CREAZIONE PACCHETTO (POST /api/packages)
// ─────────────────────────────────────────────

export const CreatePackageSchema = z
  .object({
    studentId: z
      .string({ message: "L'ID studente è obbligatorio" })
      .min(1, 'ID studente non valido'),

    standardPackageId: z.string().min(1, 'ID pacchetto standard non valido').optional().nullable(),

    nome: z
      .string({ message: 'Il nome del pacchetto è obbligatorio' })
      .min(1, 'Il nome del pacchetto non può essere vuoto')
      .max(200, 'Il nome del pacchetto non può superare 200 caratteri')
      .trim(),

    tipo: PackageTypeEnum,

    oreAcquistate: z
      .number({ message: 'Le ore acquistate sono obbligatorie' })
      .nonnegative('Le ore acquistate non possono essere negative')
      .max(9999, 'Le ore acquistate non possono superare 9999'),

    prezzoTotale: z
      .number({ message: 'Il prezzo totale è obbligatorio' })
      .nonnegative('Il prezzo non può essere negativo')
      .max(99999, 'Il prezzo non può superare € 99.999'),

    dataInizio: z.coerce.date({
      message: 'Data di inizio non valida',
    }),

    dataScadenza: z.coerce.date({ message: 'Data di scadenza non valida' }).optional().nullable(),

    tariffaOraria: z
      .number()
      .positive('La tariffa oraria deve essere maggiore di zero')
      .max(9999, 'La tariffa oraria non può superare € 9999')
      .optional(),

    note: z.string().max(2000, 'Le note non possono superare 2000 caratteri').optional().nullable(),

    // Campi obbligatori solo per pacchetti MENSILI
    giorniAcquistati: z
      .number()
      .int('I giorni devono essere un numero intero')
      .positive('I giorni acquistati devono essere maggiori di zero')
      .max(365, 'I giorni acquistati non possono superare 365')
      .optional(),

    orarioGiornaliero: z
      .number()
      .positive("L'orario giornaliero deve essere maggiore di zero")
      .max(24, "L'orario giornaliero non può superare 24 ore")
      .optional(),

    // Pagamento iniziale opzionale (acconto al momento della creazione)
    pagamentoIniziale: InitialPaymentSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Regola: la tariffa oraria è obbligatoria per i pacchetti A_CONSUMO
    if (data.tipo === 'A_CONSUMO' && !data.tariffaOraria) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tariffaOraria'],
        message: 'Per un pacchetto a consumo, la tariffa oraria è obbligatoria',
      })
    }

    // Regola: i campi MENSILE sono obbligatori se tipo = MENSILE
    if (data.tipo === 'MENSILE') {
      if (!data.giorniAcquistati) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['giorniAcquistati'],
          message: 'Per un pacchetto mensile, il numero di giorni è obbligatorio',
        })
      }
      if (!data.orarioGiornaliero) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['orarioGiornaliero'],
          message: 'Per un pacchetto mensile, le ore giornaliere sono obbligatorie',
        })
      }
    }

    // Regola: per i pacchetti ORE e MENSILE le ore non possono essere 0
    if ((data.tipo === 'ORE' || data.tipo === 'MENSILE') && data.oreAcquistate === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['oreAcquistate'],
        message: 'Le ore acquistate devono essere maggiori di zero per questo tipo di pacchetto',
      })
    }

    // Regola: il pagamento iniziale non può superare il prezzo totale
    if (data.pagamentoIniziale) {
      if (data.pagamentoIniziale.importo > data.prezzoTotale) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['pagamentoIniziale', 'importo'],
          message: `Il pagamento iniziale (€ ${data.pagamentoIniziale.importo}) non può superare il prezzo totale (€ ${data.prezzoTotale})`,
        })
      }
    }
  })

// ─────────────────────────────────────────────
// SCHEMA AGGIORNAMENTO PACCHETTO (PUT /api/packages/:id)
// ─────────────────────────────────────────────

export const UpdatePackageSchema = z
  .object({
    nome:              z.string().min(1).max(200).trim().optional(),
    tipo:              PackageTypeEnum.optional(),
    oreAcquistate:     z.number().positive().max(9999).optional(),
    prezzoTotale:      z.number().nonnegative().max(99999).optional(),
    dataInizio:        z.coerce.date().optional(),
    dataScadenza:      z.coerce.date().optional().nullable(),
    giorniAcquistati:  z.number().int().positive().max(365).optional().nullable(),
    orarioGiornaliero: z.number().positive().max(24).optional().nullable(),
    standardPackageId: z.string().min(1).optional().nullable(),
    note:              z.string().max(2000).optional().nullable(),
    sospeso:           z.boolean().optional(),
  })

// ─────────────────────────────────────────────
// SCHEMA QUERY PACCHETTI (GET /api/packages)
// ─────────────────────────────────────────────

export const PackageQuerySchema = z.object({
  studentId: z.string().min(1).optional(),
  stati:     z.string().optional(),          // Es: "ATTIVO,DA_PAGARE" (separati da virgola)
  tipo:      PackageTypeEnum.optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(100).default(20),
  latestOnly: z.enum(['true', 'false']).optional(), // Solo il pacchetto più recente per studente
})

// ─────────────────────────────────────────────
// SCHEMA RICARICA PACCHETTO A_CONSUMO (POST /api/packages/:id/recharge)
// ─────────────────────────────────────────────

export const RechargePackageSchema = z.object({
  ore: z
    .number({ message: 'Le ore da aggiungere sono obbligatorie' })
    .positive('Le ore devono essere maggiori di zero')
    .max(9999, 'Le ore non possono superare 9999'),

  importo: z
    .number({ message: "L'importo è obbligatorio" })
    .nonnegative("L'importo non può essere negativo")
    .max(99999, "L'importo non può superare € 99.999"),

  // Snapshot opzionale: se assente, si usa la tariffa del pacchetto
  tariffaOraria: z.number().positive().max(9999).optional(),

  data: z.coerce.date({ message: 'Data non valida' }).default(() => new Date()),

  // Pagamento opzionale associato alla ricarica (supporta pagamenti parziali)
  pagamentoIniziale: InitialPaymentSchema.optional(),

  note: z.string().max(500, 'Le note non possono superare 500 caratteri').optional(),

  sospeso: z.boolean().optional(),
})

// ─────────────────────────────────────────────
// TIPI TypeScript inferiti dagli schemi
// ─────────────────────────────────────────────
export type CreatePackageInput  = z.infer<typeof CreatePackageSchema>
export type UpdatePackageInput  = z.infer<typeof UpdatePackageSchema>
export type InitialPaymentInput = z.infer<typeof InitialPaymentSchema>
export type RechargePackageInput = z.infer<typeof RechargePackageSchema>
export type PackageQuery        = z.infer<typeof PackageQuerySchema>
export type PackageStatus       = z.infer<typeof PackageStatusEnum>
export type PackageType         = z.infer<typeof PackageTypeEnum>

// ─────────────────────────────────────────────
// SCHEMA MODIFICA AVANZATA PACCHETTO (POST /api/packages/:id/upgrade)
// Usato per cambiare le ore acquistate / giorni, e gestire integrazioni
// ─────────────────────────────────────────────

export const UpgradePackageSchema = z.object({
  // Quantità finali (devono sempre coprire almeno ciò che è stato consumato)
  nuoveOreAcquistate: z.number().nonnegative().optional(),
  nuoviGiorniAcquistati: z.number().int().nonnegative().optional(),
  
  // Nuovo prezzo totale (può diminuire se le ore diminuiscono, ma non sotto il pagato, validato a server)
  nuovoPrezzoTotale: z.number().nonnegative(),
  
  // Scadenza
  nuovaDataScadenza: z.coerce.date().optional().nullable(),
  
  // Pagamento di integrazione (obbligatorio se nuovoPrezzoTotale > prezzoTotalePrecedente e importoPagato era totale, ma il server lo gestirà come opzionale se la differenza viene messa "in debito" o saldata subito)
  pagamentoIntegrazione: InitialPaymentSchema.optional(),
})

export type UpgradePackageInput = z.infer<typeof UpgradePackageSchema>
