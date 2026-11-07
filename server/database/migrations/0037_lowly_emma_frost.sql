ALTER TYPE "public"."notifica_tipo" ADD VALUE 'EMAIL';--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tipo" varchar(40) NOT NULL,
	"destinatario" varchar(320) NOT NULL,
	"nome_destinatario" varchar(200),
	"oggetto" varchar(300) NOT NULL,
	"esito" varchar(20) NOT NULL,
	"motivo" varchar(40),
	"dettaglio" text,
	"invio_id" text
);
--> statement-breakpoint
CREATE INDEX "email_log_created_at_idx" ON "email_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_log_invio_idx" ON "email_log" USING btree ("invio_id");--> statement-breakpoint
ALTER TABLE "email_log" ENABLE ROW LEVEL SECURITY;
