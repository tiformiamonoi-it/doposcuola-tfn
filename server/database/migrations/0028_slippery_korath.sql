CREATE TYPE "public"."assenza_origine" AS ENUM('PORTALE', 'GESTIONALE');--> statement-breakpoint
CREATE TABLE "assenze" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"data" date NOT NULL,
	"motivo" varchar(200),
	"segnalata_da_user_id" text,
	"origine" "assenza_origine" NOT NULL,
	"oltre_il_termine" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_notes" ADD COLUMN "avviso_inviato_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assenze" ADD CONSTRAINT "assenze_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assenze" ADD CONSTRAINT "assenze_segnalata_da_user_id_users_id_fk" FOREIGN KEY ("segnalata_da_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assenze_student_data_uq" ON "assenze" USING btree ("student_id","data");--> statement-breakpoint
CREATE INDEX "assenze_data_idx" ON "assenze" USING btree ("data");