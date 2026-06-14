CREATE TYPE "public"."accounting_type" AS ENUM('ENTRATA', 'USCITA', 'NOTA');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."lesson_type" AS ENUM('SINGOLA', 'GRUPPO', 'MAXI');--> statement-breakpoint
CREATE TYPE "public"."note_visibilita" AS ENUM('INTERNA', 'FAMIGLIA');--> statement-breakpoint
CREATE TYPE "public"."package_status" AS ENUM('ATTIVO', 'DA_RINNOVARE', 'SCADUTO', 'ESAURITO', 'DA_PAGARE', 'PAGATO', 'CHIUSO');--> statement-breakpoint
CREATE TYPE "public"."package_type" AS ENUM('ORE', 'MENSILE');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('ACCONTO', 'SALDO', 'RATA', 'INTEGRAZIONE');--> statement-breakpoint
CREATE TYPE "public"."reimbursement_status" AS ENUM('DA_PAGARE', 'PARZIALE', 'PAGATO');--> statement-breakpoint
CREATE TYPE "public"."tutor_payment_mode" AS ENUM('ORE', 'FORFAIT');--> statement-breakpoint
CREATE TYPE "public"."tutor_payment_status" AS ENUM('PAGATO', 'PARZIALE', 'PRO_BONO');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'SUPER_TUTOR', 'TUTOR', 'GENITORE');--> statement-breakpoint
CREATE TABLE "accounting_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" "accounting_type" NOT NULL,
	"importo" numeric(10, 2) NOT NULL,
	"descrizione" text NOT NULL,
	"categoria" varchar(100),
	"data" timestamp DEFAULT now() NOT NULL,
	"package_id" text,
	"lesson_id" text,
	"payment_id" text,
	"metodo_pagamento" "payment_method",
	"fattura_emessa" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_entries_payment_id_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
CREATE TABLE "booking_subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"booking_id" text NOT NULL,
	"assigned_tutor_id" text,
	"assigned_slot" varchar(20),
	"assigned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"student_name" varchar(100) NOT NULL,
	"student_surname" varchar(100) NOT NULL,
	"student_phone" varchar(20) NOT NULL,
	"requested_date" timestamp NOT NULL,
	"notes" text,
	"status" "booking_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closure_dates" (
	"id" text PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "closure_dates_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "lesson_students" (
	"id" text PRIMARY KEY NOT NULL,
	"lesson_id" text NOT NULL,
	"student_id" text NOT NULL,
	"package_id" text NOT NULL,
	"mezza_lezione" boolean DEFAULT false NOT NULL,
	"ore_scalate" numeric(10, 2) DEFAULT '1.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"tutor_id" text NOT NULL,
	"time_slot_id" text NOT NULL,
	"data" timestamp NOT NULL,
	"tipo" "lesson_type" DEFAULT 'SINGOLA' NOT NULL,
	"forza_gruppo" boolean DEFAULT false NOT NULL,
	"compenso_tutor" numeric(10, 2),
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"standard_package_id" text,
	"nome" varchar(200) NOT NULL,
	"tipo" "package_type" DEFAULT 'ORE' NOT NULL,
	"ore_acquistate" numeric(10, 2) NOT NULL,
	"ore_residuo" numeric(10, 2) NOT NULL,
	"ore_perse" numeric(10, 2) DEFAULT '0' NOT NULL,
	"giorni_acquistati" integer,
	"giorni_residuo" integer,
	"orario_giornaliero" numeric(10, 2),
	"prezzo_totale" numeric(10, 2) NOT NULL,
	"importo_pagato" numeric(10, 2) DEFAULT '0' NOT NULL,
	"importo_residuo" numeric(10, 2) NOT NULL,
	"data_inizio" timestamp NOT NULL,
	"data_scadenza" timestamp,
	"stati" "package_status"[] DEFAULT '{"ATTIVO"}' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"package_id" text NOT NULL,
	"importo" numeric(10, 2) NOT NULL,
	"tipo_pagamento" "payment_type" DEFAULT 'ACCONTO' NOT NULL,
	"metodo_pagamento" "payment_method" DEFAULT 'CONTANTI' NOT NULL,
	"richiede_fattura" boolean DEFAULT false NOT NULL,
	"data_pagamento" timestamp DEFAULT now() NOT NULL,
	"riferimento" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standard_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" varchar(200) NOT NULL,
	"descrizione" text,
	"tipo" "package_type" DEFAULT 'ORE' NOT NULL,
	"categoria" varchar(100) NOT NULL,
	"ore_incluse" numeric(10, 2) NOT NULL,
	"giorni_inclusi" integer,
	"orario_giornaliero" numeric(10, 2),
	"prezzo_standard" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"author_id" text NOT NULL,
	"contenuto" text NOT NULL,
	"visibilita" "note_visibilita" DEFAULT 'INTERNA' NOT NULL,
	"lesson_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"referred_id" text NOT NULL,
	"referrer_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"classe" varchar(50),
	"scuola" varchar(100),
	"student_phone" varchar(20),
	"student_email" varchar(255),
	"parent_name" varchar(200),
	"parent_email" varchar(255),
	"parent_phone" varchar(20),
	"parent_indirizzo" text,
	"parent_citta" varchar(100),
	"parent_cap" varchar(10),
	"parent_cf" varchar(20),
	"parent_piva" varchar(20),
	"active" boolean DEFAULT true NOT NULL,
	"note" text,
	"bisogni_speciali" text,
	"portal_user_id" text,
	"abilitato_prenotazione_online" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"category" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_configs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "time_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"ora_inizio" varchar(5) NOT NULL,
	"ora_fine" varchar(5) NOT NULL,
	"descrizione" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_availabilities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"tutor_id" text NOT NULL,
	"mese" timestamp NOT NULL,
	"importo" numeric(10, 2) NOT NULL,
	"data_pagamento" timestamp DEFAULT now() NOT NULL,
	"metodo" "payment_method" DEFAULT 'BONIFICO' NOT NULL,
	"status" "tutor_payment_status" DEFAULT 'PAGATO' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"indirizzo" text,
	"citta" varchar(100),
	"cap" varchar(10),
	"codice_fiscale" varchar(20),
	"partita_iva" varchar(20),
	"materie" text[] DEFAULT '{}' NOT NULL,
	"note_interne" text,
	"modalita_pagamento" "tutor_payment_mode" DEFAULT 'ORE' NOT NULL,
	"importo_forfait" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tutor_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "tutor_reimbursements" (
	"id" text PRIMARY KEY NOT NULL,
	"tutor_id" text NOT NULL,
	"importo" numeric(10, 2) NOT NULL,
	"importo_pagato" numeric(10, 2) DEFAULT '0' NOT NULL,
	"descrizione" text NOT NULL,
	"data_richiesta" timestamp DEFAULT now() NOT NULL,
	"data_pagamento" timestamp,
	"stato" "reimbursement_status" DEFAULT 'DA_PAGARE' NOT NULL,
	"metodo" "payment_method",
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"role" "user_role" DEFAULT 'TUTOR' NOT NULL,
	"phone" varchar(20),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_subjects" ADD CONSTRAINT "booking_subjects_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_subjects" ADD CONSTRAINT "booking_subjects_assigned_tutor_id_users_id_fk" FOREIGN KEY ("assigned_tutor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_students" ADD CONSTRAINT "lesson_students_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_students" ADD CONSTRAINT "lesson_students_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_students" ADD CONSTRAINT "lesson_students_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_tutor_id_users_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_standard_package_id_standard_packages_id_fk" FOREIGN KEY ("standard_package_id") REFERENCES "public"."standard_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_referrals" ADD CONSTRAINT "student_referrals_referred_id_students_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_referrals" ADD CONSTRAINT "student_referrals_referrer_id_students_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_portal_user_id_users_id_fk" FOREIGN KEY ("portal_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_availabilities" ADD CONSTRAINT "tutor_availabilities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_payments" ADD CONSTRAINT "tutor_payments_tutor_id_users_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_reimbursements" ADD CONSTRAINT "tutor_reimbursements_tutor_id_users_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acc_tipo_data_idx" ON "accounting_entries" USING btree ("tipo","data");--> statement-breakpoint
CREATE INDEX "acc_categoria_idx" ON "accounting_entries" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "acc_metodo_idx" ON "accounting_entries" USING btree ("metodo_pagamento");--> statement-breakpoint
CREATE INDEX "booking_subjects_booking_idx" ON "booking_subjects" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_subjects_tutor_idx" ON "booking_subjects" USING btree ("assigned_tutor_id");--> statement-breakpoint
CREATE INDEX "bookings_status_date_idx" ON "bookings" USING btree ("status","requested_date");--> statement-breakpoint
CREATE INDEX "bookings_user_idx" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "closure_date_idx" ON "closure_dates" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "ls_unique" ON "lesson_students" USING btree ("lesson_id","student_id");--> statement-breakpoint
CREATE INDEX "ls_student_idx" ON "lesson_students" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "ls_package_student_idx" ON "lesson_students" USING btree ("package_id","student_id");--> statement-breakpoint
CREATE INDEX "lessons_data_tutor_idx" ON "lessons" USING btree ("data","tutor_id");--> statement-breakpoint
CREATE INDEX "lessons_tutor_data_idx" ON "lessons" USING btree ("tutor_id","data");--> statement-breakpoint
CREATE INDEX "pkg_student_stati_idx" ON "packages" USING btree ("student_id","stati");--> statement-breakpoint
CREATE INDEX "pkg_tipo_created_idx" ON "packages" USING btree ("tipo","created_at");--> statement-breakpoint
CREATE INDEX "payments_pkg_date_idx" ON "payments" USING btree ("package_id","data_pagamento");--> statement-breakpoint
CREATE INDEX "std_pkg_categoria_tipo_idx" ON "standard_packages" USING btree ("categoria","tipo");--> statement-breakpoint
CREATE INDEX "notes_student_idx" ON "student_notes" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "notes_author_idx" ON "student_notes" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "notes_visibilita_idx" ON "student_notes" USING btree ("visibilita");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_unique_pair" ON "student_referrals" USING btree ("referred_id","referrer_id");--> statement-breakpoint
CREATE INDEX "referral_referred_idx" ON "student_referrals" USING btree ("referred_id");--> statement-breakpoint
CREATE INDEX "referral_referrer_idx" ON "student_referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "students_active_name_idx" ON "students" USING btree ("active","last_name","first_name");--> statement-breakpoint
CREATE INDEX "students_portal_user_idx" ON "students" USING btree ("portal_user_id");--> statement-breakpoint
CREATE INDEX "system_configs_category_idx" ON "system_configs" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "time_slots_unique" ON "time_slots" USING btree ("ora_inizio","ora_fine");--> statement-breakpoint
CREATE UNIQUE INDEX "availability_user_date_unique" ON "tutor_availabilities" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "availability_date_idx" ON "tutor_availabilities" USING btree ("date");--> statement-breakpoint
CREATE INDEX "tutor_payments_tutor_mese_idx" ON "tutor_payments" USING btree ("tutor_id","mese");--> statement-breakpoint
CREATE INDEX "reimbursements_tutor_stato_idx" ON "tutor_reimbursements" USING btree ("tutor_id","stato");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");