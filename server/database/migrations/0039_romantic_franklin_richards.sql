ALTER TABLE "users" ADD COLUMN "notifiche_viste_at" timestamp with time zone;--> statement-breakpoint
-- CODICE DELLA CARD STUDENTE. La colonna nasce vuota, si riempie per ogni alunno già in
-- archivio e solo DOPO diventa obbligatoria e unica: aggiunta subito NOT NULL, Postgres
-- la rifiuterebbe perché le righe esistenti non avrebbero un valore.
-- Stesso formato e stesso alfabeto di shared/card-studente.ts (niente 0/O, 1/I/L), es. K7QF-29XM.
-- Il caso viene da gen_random_uuid(), che è casuale "vero" (random() non lo è): si usano
-- i byte dell'UUID tranne il 6 e l'8, che portano versione e variante e non sono casuali.
-- Se per assurdo esce un codice già dato, il ciclo ne tira un altro.
ALTER TABLE "students" ADD COLUMN "codice_card" varchar(9);--> statement-breakpoint
DO $$
DECLARE
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  posizioni constant int[] := ARRAY[0, 1, 2, 3, 4, 5, 10, 11];
  riga record;
  b bytea;
  codice text;
BEGIN
  FOR riga IN SELECT id FROM students WHERE codice_card IS NULL LOOP
    LOOP
      b := uuid_send(gen_random_uuid());
      codice := '';
      FOR i IN 1..8 LOOP
        codice := codice || substr(alfabeto, get_byte(b, posizioni[i]) % 31 + 1, 1);
        IF i = 4 THEN codice := codice || '-'; END IF;
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM students WHERE codice_card = codice);
    END LOOP;
    UPDATE students SET codice_card = codice WHERE id = riga.id;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "codice_card" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_codice_card_unique" UNIQUE("codice_card");
