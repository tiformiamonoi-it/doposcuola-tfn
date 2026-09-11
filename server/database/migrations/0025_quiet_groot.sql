CREATE TABLE "contact_figli" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"nome" varchar(200),
	"classe_scuola" varchar(200),
	"materie" varchar(500),
	"student_id" text,
	"ordine" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "tutor_user_id" text;--> statement-breakpoint
ALTER TABLE "contact_figli" ADD CONSTRAINT "contact_figli_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_figli" ADD CONSTRAINT "contact_figli_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_figli_contact_ordine_idx" ON "contact_figli" USING btree ("contact_id","ordine");--> statement-breakpoint
CREATE INDEX "contact_figli_student_idx" ON "contact_figli" USING btree ("student_id");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tutor_user_id_users_id_fk" FOREIGN KEY ("tutor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- COPIA DEI FIGLI GIÀ REGISTRATI (voce D2, scritta a mano dopo la generazione).
-- Fino a oggi ogni contatto "Possibile studente" aveva UN figlio solo, scritto in
-- tre colonne del contatto. Qui quel figlio diventa la prima riga di contact_figli,
-- col suo eventuale collegamento allo studente già creato.
-- Le tre colonne di prima NON si cancellano: il sito online le usa ancora finché
-- non viene pubblicato il codice nuovo. Si tolgono nella pulizia finale (H2).
-- Si può rilanciare senza danni: NOT EXISTS salta i contatti che hanno già i figli.
INSERT INTO "contact_figli" ("id","contact_id","nome","classe_scuola","materie","student_id","ordine","created_at","updated_at")
SELECT 'mig' || md5(random()::text || c."id"),
       c."id",
       NULLIF(btrim(c."nome_studente"), ''),
       NULLIF(btrim(c."classe_scuola"), ''),
       NULLIF(btrim(c."materie"), ''),
       c."student_id", 0, c."created_at", now()
FROM "contacts" c
WHERE c."tipo" = 'DOPOSCUOLA'
  AND c."doposcuola_ruolo" = 'STUDENTE'
  AND c."anonimizzato_at" IS NULL
  AND (   NULLIF(btrim(c."nome_studente"), '') IS NOT NULL
       OR NULLIF(btrim(c."classe_scuola"), '') IS NOT NULL
       OR NULLIF(btrim(c."materie"), '')       IS NOT NULL
       OR c."student_id" IS NOT NULL )
  AND NOT EXISTS (SELECT 1 FROM "contact_figli" f WHERE f."contact_id" = c."id");