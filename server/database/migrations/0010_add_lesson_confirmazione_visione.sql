ALTER TABLE "lessons" ADD COLUMN "confermata" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "confermata_da" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "confermata_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_confermata_da_users_id_fk" FOREIGN KEY ("confermata_da") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;