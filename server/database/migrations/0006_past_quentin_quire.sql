ALTER TABLE "accounting_entries" DROP CONSTRAINT "accounting_entries_payment_id_payments_id_fk";
--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN "tutor_payment_id" text;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN "reimbursement_id" text;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_tutor_payment_id_tutor_payments_id_fk" FOREIGN KEY ("tutor_payment_id") REFERENCES "public"."tutor_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_reimbursement_id_tutor_reimbursements_id_fk" FOREIGN KEY ("reimbursement_id") REFERENCES "public"."tutor_reimbursements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acc_tutor_payment_idx" ON "accounting_entries" USING btree ("tutor_payment_id");--> statement-breakpoint
CREATE INDEX "acc_reimbursement_idx" ON "accounting_entries" USING btree ("reimbursement_id");--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_tutor_payment_id_unique" UNIQUE("tutor_payment_id");