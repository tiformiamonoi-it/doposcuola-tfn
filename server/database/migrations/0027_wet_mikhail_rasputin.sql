ALTER TABLE "payments" ADD COLUMN "bollo_registrato_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN "versamento_entry_id" text;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_versamento_entry_id_accounting_entries_id_fk" FOREIGN KEY ("versamento_entry_id") REFERENCES "public"."accounting_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acc_versamento_idx" ON "accounting_entries" USING btree ("versamento_entry_id");