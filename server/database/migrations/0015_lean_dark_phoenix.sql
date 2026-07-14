ALTER TABLE "closure_dates" ALTER COLUMN "date" SET DATA TYPE date USING ("date" AT TIME ZONE 'UTC')::date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "note_last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN "richiede_fattura" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN "linked_entry_id" text;--> statement-breakpoint
ALTER TABLE "student_notes" ADD COLUMN "approvata_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_linked_entry_id_accounting_entries_id_fk" FOREIGN KEY ("linked_entry_id") REFERENCES "public"."accounting_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "student_notes" SET "approvata_at" = "created_at";