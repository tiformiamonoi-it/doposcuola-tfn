ALTER TABLE "bookings" ADD COLUMN "supplemento" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "supplemento_applicato_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "supplemento_package_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_supplemento_package_id_packages_id_fk" FOREIGN KEY ("supplemento_package_id") REFERENCES "public"."packages"("id") ON DELETE set null ON UPDATE no action;