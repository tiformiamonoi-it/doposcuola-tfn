CREATE TABLE "tutor_tariffe_speciali" (
	"id" text PRIMARY KEY NOT NULL,
	"tutor_id" text,
	"student_id" text,
	"time_slot_ids" text[] DEFAULT '{}' NOT NULL,
	"tariffa_oraria" numeric(10, 2) NOT NULL,
	"valida_dal" date NOT NULL,
	"nota" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "compenso_forzato" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "compenso_forzato_da" text;--> statement-breakpoint
ALTER TABLE "tutor_tariffe_speciali" ADD CONSTRAINT "tutor_tariffe_speciali_tutor_id_users_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_tariffe_speciali" ADD CONSTRAINT "tutor_tariffe_speciali_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_tariffe_speciali" ADD CONSTRAINT "tutor_tariffe_speciali_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tutor_tariffe_speciali_tutor_idx" ON "tutor_tariffe_speciali" USING btree ("tutor_id");--> statement-breakpoint
CREATE INDEX "tutor_tariffe_speciali_student_idx" ON "tutor_tariffe_speciali" USING btree ("student_id");--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_compenso_forzato_da_users_id_fk" FOREIGN KEY ("compenso_forzato_da") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;