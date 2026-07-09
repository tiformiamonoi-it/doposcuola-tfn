ALTER TYPE "package_status" ADD VALUE 'SOSPESO';--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "sospeso" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "pkg_sospeso_idx" ON "packages" USING btree ("sospeso");