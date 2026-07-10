ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_accepted_version" varchar(20);--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "avviso_ore_inviato_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "avviso_scadenza_inviato_at" timestamp with time zone;