CREATE TYPE "public"."consenso_origine" AS ENUM('PORTALE', 'GESTIONALE');--> statement-breakpoint
CREATE TYPE "public"."consenso_tipo" AS ENUM('MINORE_14', 'IMMAGINI', 'MARKETING');--> statement-breakpoint
CREATE TABLE "consensi" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" "consenso_tipo" NOT NULL,
	"student_id" text,
	"user_id" text,
	"valore" boolean NOT NULL,
	"testo_versione" varchar(40),
	"origine" "consenso_origine" NOT NULL,
	"attore_user_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consensi" ADD CONSTRAINT "consensi_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consensi" ADD CONSTRAINT "consensi_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consensi" ADD CONSTRAINT "consensi_attore_user_id_users_id_fk" FOREIGN KEY ("attore_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consensi_student_tipo_idx" ON "consensi" USING btree ("student_id","tipo","created_at");--> statement-breakpoint
CREATE INDEX "consensi_user_tipo_idx" ON "consensi" USING btree ("user_id","tipo","created_at");