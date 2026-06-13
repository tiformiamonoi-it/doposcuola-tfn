ALTER TABLE "bookings" ADD COLUMN "student_id" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "mezza_lezione" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_student_idx" ON "bookings" USING btree ("student_id");--> statement-breakpoint
ALTER TABLE "lesson_students" DROP COLUMN "mezza_lezione";