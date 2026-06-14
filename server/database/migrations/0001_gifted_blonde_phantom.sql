ALTER TYPE "public"."package_type" ADD VALUE 'A_CONSUMO';--> statement-breakpoint
CREATE TABLE "package_recharges" (
	"id" text PRIMARY KEY NOT NULL,
	"package_id" text NOT NULL,
	"ore" numeric(10, 2) NOT NULL,
	"tariffa_oraria" numeric(10, 2) NOT NULL,
	"importo" numeric(10, 2) NOT NULL,
	"data" timestamp DEFAULT now() NOT NULL,
	"payment_id" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "tariffa_oraria" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "standard_packages" ADD COLUMN "tariffa_oraria" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "package_recharges" ADD CONSTRAINT "package_recharges_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_recharges" ADD CONSTRAINT "package_recharges_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recharges_package_data_idx" ON "package_recharges" USING btree ("package_id","data");