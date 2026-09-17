CREATE TABLE "tutor_assenze" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tutor_profiles" ADD COLUMN "sempre_disponibile" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tutor_assenze" ADD CONSTRAINT "tutor_assenze_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_assenze" ADD CONSTRAINT "tutor_assenze_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_assenze_user_date_unique" ON "tutor_assenze" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "tutor_assenze_date_idx" ON "tutor_assenze" USING btree ("date");