CREATE TYPE "public"."comunicazione_tipo" AS ENUM('INFORMATIVA', 'PROMOZIONALE');--> statement-breakpoint
CREATE TABLE "comunicazioni" (
	"id" text PRIMARY KEY NOT NULL,
	"titolo" varchar(150) NOT NULL,
	"testo" text NOT NULL,
	"tipo" "comunicazione_tipo" NOT NULL,
	"author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminata_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "comunicazioni_destinatari" (
	"id" text PRIMARY KEY NOT NULL,
	"comunicazione_id" text NOT NULL,
	"user_id" text NOT NULL,
	"letta_at" timestamp with time zone,
	"email_inviata_at" timestamp with time zone,
	"email_errore" text
);
--> statement-breakpoint
ALTER TABLE "comunicazioni" ADD CONSTRAINT "comunicazioni_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comunicazioni_destinatari" ADD CONSTRAINT "comunicazioni_destinatari_comunicazione_id_comunicazioni_id_fk" FOREIGN KEY ("comunicazione_id") REFERENCES "public"."comunicazioni"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comunicazioni_destinatari" ADD CONSTRAINT "comunicazioni_destinatari_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comunicazioni_created_idx" ON "comunicazioni" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "comunicazioni_destinatari_unico_idx" ON "comunicazioni_destinatari" USING btree ("comunicazione_id","user_id");--> statement-breakpoint
CREATE INDEX "comunicazioni_destinatari_user_idx" ON "comunicazioni_destinatari" USING btree ("user_id");