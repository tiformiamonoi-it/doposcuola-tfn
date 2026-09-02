CREATE TABLE IF NOT EXISTS "student_parents" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"parent_user_id" text NOT NULL,
	"relazione" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_parents" DROP CONSTRAINT IF EXISTS "student_parents_student_id_students_id_fk";--> statement-breakpoint
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_parents" DROP CONSTRAINT IF EXISTS "student_parents_parent_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_parents_unique_pair" ON "student_parents" USING btree ("student_id","parent_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_parents_student_idx" ON "student_parents" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_parents_parent_idx" ON "student_parents" USING btree ("parent_user_id");--> statement-breakpoint
ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_portal_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "students_portal_user_idx";--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN IF EXISTS "portal_user_id";
