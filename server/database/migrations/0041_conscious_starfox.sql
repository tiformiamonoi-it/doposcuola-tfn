-- CODICE DELLA CARD DEL GENITORE. Ogni account GENITORE ha la sua card (deciso il 16/11/2026),
-- lo staff no: per questo la colonna resta facoltativa (niente NOT NULL), ma è UNICA.
ALTER TABLE "users" ADD COLUMN "codice_card" varchar(9);--> statement-breakpoint
-- "Ore quasi finite dal": la scrive il cron delle 06 UTC, vedi schema/packages.ts
ALTER TABLE "packages" ADD COLUMN "ore_quasi_finite_dal" timestamp with time zone;--> statement-breakpoint
-- Il codice ai genitori già registrati, nello stesso modo della 0039 (stesso formato e stesso
-- alfabeto di shared/card-studente.ts, il caso da gen_random_uuid() senza i byte 6 e 8).
-- Un codice nuovo si scarta se c'è già tra i genitori O TRA GLI ALUNNI: la pagina del negozio
-- cerca nelle due tabelle e lo stesso codice non deve mai portare a due persone.
DO $$
DECLARE
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  posizioni constant int[] := ARRAY[0, 1, 2, 3, 4, 5, 10, 11];
  riga record;
  b bytea;
  codice text;
BEGIN
  FOR riga IN SELECT id FROM users WHERE role = 'GENITORE' AND codice_card IS NULL LOOP
    LOOP
      b := uuid_send(gen_random_uuid());
      codice := '';
      FOR i IN 1..8 LOOP
        codice := codice || substr(alfabeto, get_byte(b, posizioni[i]) % 31 + 1, 1);
        IF i = 4 THEN codice := codice || '-'; END IF;
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE codice_card = codice)
            AND NOT EXISTS (SELECT 1 FROM students WHERE codice_card = codice);
    END LOOP;
    UPDATE users SET codice_card = codice WHERE id = riga.id;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_codice_card_unique" UNIQUE("codice_card");
