ALTER TYPE "public"."user_role" ADD VALUE 'STUDENTE';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "terms_accepted_version" SET DATA TYPE varchar(40);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consenso_genitore_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tutorial_visto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "student_user_id" text;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;