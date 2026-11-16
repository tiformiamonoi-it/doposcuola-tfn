-- CODICE DELLA CARD DEL TUTOR. Ogni account TUTOR ha la sua card (deciso il 16/11/2026),
-- nella stessa colonna dei genitori (users.codice_card, nata con la 0041): niente schema nuovo.
-- Stesso SQL della 0041 (stesso formato e stesso alfabeto di shared/card-studente.ts): un
-- codice nuovo si scarta se c'è già tra gli utenti O TRA GLI ALUNNI, perché la pagina del
-- negozio cerca in tutte e due le tabelle. SUPER_TUTOR e ADMIN restano senza card.
DO $$
DECLARE
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  posizioni constant int[] := ARRAY[0, 1, 2, 3, 4, 5, 10, 11];
  riga record;
  b bytea;
  codice text;
BEGIN
  FOR riga IN SELECT id FROM users WHERE role = 'TUTOR' AND codice_card IS NULL LOOP
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
END $$;
