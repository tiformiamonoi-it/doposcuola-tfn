CREATE TYPE "public"."notifica_tipo" AS ENUM('CONSENSO', 'COMPLEANNO', 'GENERICA');--> statement-breakpoint
CREATE TABLE "notifiche" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" "notifica_tipo" DEFAULT 'GENERICA' NOT NULL,
	"titolo" varchar(200) NOT NULL,
	"messaggio" text NOT NULL,
	"link" varchar(500),
	"entity_type" varchar(50),
	"entity_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"letta_at" timestamp with time zone,
	"letta_da_user_id" text
);
--> statement-breakpoint
ALTER TABLE "tutor_profiles" ADD COLUMN "data_nascita" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "data_nascita" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consenso_genitore_registrato_da_user_id" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "data_nascita" date;--> statement-breakpoint
ALTER TABLE "notifiche" ADD CONSTRAINT "notifiche_letta_da_user_id_users_id_fk" FOREIGN KEY ("letta_da_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifiche_da_leggere_idx" ON "notifiche" USING btree ("letta_at","created_at");--> statement-breakpoint
CREATE INDEX "notifiche_entity_idx" ON "notifiche" USING btree ("entity_type","entity_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_consenso_genitore_registrato_da_user_id_users_id_fk" FOREIGN KEY ("consenso_genitore_registrato_da_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;