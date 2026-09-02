CREATE TYPE "public"."confirmation_status" AS ENUM('DA_SENTIRE', 'CONFERMATO', 'IN_FORSE', 'NON_TORNA');--> statement-breakpoint
CREATE TABLE "student_confirmations" (
	"id" text PRIMARY KEY NOT NULL,
	"anno" varchar(9) NOT NULL,
	"student_id" text NOT NULL,
	"stato" "confirmation_status" DEFAULT 'DA_SENTIRE' NOT NULL,
	"data_risposta" date,
	"note" text,
	"aggiornato_da_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_confirmations" ADD CONSTRAINT "student_confirmations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_confirmations" ADD CONSTRAINT "student_confirmations_aggiornato_da_user_id_users_id_fk" FOREIGN KEY ("aggiornato_da_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_confirmations_anno_student_unique" ON "student_confirmations" USING btree ("anno","student_id");--> statement-breakpoint
CREATE INDEX "student_confirmations_anno_stato_idx" ON "student_confirmations" USING btree ("anno","stato");--> statement-breakpoint
CREATE INDEX "student_confirmations_student_idx" ON "student_confirmations" USING btree ("student_id");