CREATE TYPE "public"."contact_canale" AS ENUM('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'WHATSAPP', 'TELEFONO', 'SITO_WEB', 'EMAIL', 'PASSAPAROLA', 'META_ADS', 'GOOGLE_ADS', 'ALTRO');--> statement-breakpoint
CREATE TYPE "public"."contact_marketing_ruolo" AS ENUM('CLIENTE', 'PARTNER');--> statement-breakpoint
CREATE TYPE "public"."contact_stato" AS ENUM('NUOVO', 'DA_RICONTATTARE', 'IN_TRATTATIVA', 'CONVERTITO', 'PERSO');--> statement-breakpoint
CREATE TYPE "public"."contact_tipo" AS ENUM('DOPOSCUOLA', 'MARKETING');--> statement-breakpoint
CREATE TYPE "public"."interaction_direzione" AS ENUM('RICEVUTA', 'EFFETTUATA');--> statement-breakpoint
CREATE TYPE "public"."interaction_esito" AS ENUM('RISPOSTO', 'NESSUNA_RISPOSTA', 'DA_RICHIAMARE');--> statement-breakpoint
CREATE TYPE "public"."interaction_tipo" AS ENUM('CHIAMATA', 'MESSAGGIO', 'EMAIL', 'INCONTRO', 'ALTRO');--> statement-breakpoint
CREATE TABLE "contact_interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"tipo" "interaction_tipo" NOT NULL,
	"direzione" "interaction_direzione" NOT NULL,
	"canale" "contact_canale" NOT NULL,
	"esito" "interaction_esito",
	"note" text,
	"data" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" "contact_tipo" NOT NULL,
	"nome" varchar(100) NOT NULL,
	"cognome" varchar(100),
	"telefono" varchar(20),
	"email" varchar(255),
	"canale_origine" "contact_canale" DEFAULT 'ALTRO' NOT NULL,
	"stato" "contact_stato" DEFAULT 'NUOVO' NOT NULL,
	"prossimo_ricontatto" date,
	"ultimo_contatto_at" timestamp with time zone,
	"note" text,
	"nome_studente" varchar(200),
	"classe_scuola" varchar(200),
	"materie" varchar(500),
	"azienda" varchar(200),
	"servizio_interesse" varchar(200),
	"marketing_ruolo" "contact_marketing_ruolo",
	"privacy_informata" boolean DEFAULT false NOT NULL,
	"student_id" text,
	"contact_request_id" text,
	"created_by_user_id" text,
	"convertito_at" timestamp with time zone,
	"archiviato_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_interactions" ADD CONSTRAINT "contact_interactions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_interactions" ADD CONSTRAINT "contact_interactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contact_request_id_contact_requests_id_fk" FOREIGN KEY ("contact_request_id") REFERENCES "public"."contact_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_interactions_contact_data_idx" ON "contact_interactions" USING btree ("contact_id","data");--> statement-breakpoint
CREATE INDEX "contacts_tipo_stato_idx" ON "contacts" USING btree ("tipo","stato");--> statement-breakpoint
CREATE INDEX "contacts_prossimo_ricontatto_idx" ON "contacts" USING btree ("prossimo_ricontatto");--> statement-breakpoint
CREATE INDEX "contacts_telefono_idx" ON "contacts" USING btree ("telefono");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "contacts_archiviato_idx" ON "contacts" USING btree ("archiviato_at");