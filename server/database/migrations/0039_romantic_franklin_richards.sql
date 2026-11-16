ALTER TABLE "users" ADD COLUMN "notifiche_viste_at" timestamp with time zone;--> statement-breakpoint
-- Foto facoltativa della comunicazione (data URI), vedi schema/comunicazioni.ts
ALTER TABLE "comunicazioni" ADD COLUMN "immagine" text;--> statement-breakpoint
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
ALTER TABLE "students" ADD CONSTRAINT "students_codice_card_unique" UNIQUE("codice_card");--> statement-breakpoint
-- LE CONVENZIONI IN UNA TABELLA VERA. Fino a oggi stavano in un JSON dentro
-- system_configs (key = 'sconti'), foto comprese: diventando parecchie, quella riga
-- letta intera a ogni apertura del portale era troppo pesante.
CREATE TABLE "convenzioni" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"descrizione" text NOT NULL,
	"immagine" text,
	"categoria" text,
	"citta" text,
	"sconto" text,
	"indirizzo" text,
	"orari" text,
	"telefono" text,
	"valida_fino" date,
	"creata_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "convenzioni_valida_fino_idx" ON "convenzioni" USING btree ("valida_fino");--> statement-breakpoint
CREATE INDEX "convenzioni_creata_at_idx" ON "convenzioni" USING btree ("creata_at");--> statement-breakpoint
-- Nel nostro Supabase tutte le tabelle hanno la RLS accesa e nessuna policy: dall'esterno
-- (API pubblica di Supabase) non si legge niente; l'app entra come postgres e non ne risente.
ALTER TABLE "convenzioni" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- LA COPIA DELLE CONVENZIONI ESISTENTI, dal JSON alla tabella, foto comprese.
-- - creataAt si CONSERVA: è da lì che il riepilogo serale capisce cosa ha già annunciato
--   (segnalibro 'sconti_annunciate_fino_a'). Quelle senza data (nate prima che la data
--   esistesse) restano SENZA data: contano come già note, come prima. Con now() verrebbero
--   riannunciate stasera a tutte le famiglie come "nuove".
-- - I campi vuoti diventano NULL; "valida fino al" solo se è un giorno AAAA-MM-GG.
-- - L'id è un UUID casuale (le convenzioni nuove avranno un cuid): non si indovina.
-- La riga 'sconti' di system_configs NON si cancella: resta come copia di sicurezza,
-- semplicemente non la legge più nessuno.
INSERT INTO "convenzioni" ("id", "nome", "descrizione", "immagine", "categoria", "citta", "sconto",
  "indirizzo", "orari", "telefono", "valida_fino", "creata_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  coalesce(e->>'nome', ''),
  coalesce(e->>'descrizione', ''),
  nullif(e->>'immagine', ''),
  nullif(btrim(e->>'categoria'), ''),
  nullif(btrim(e->>'citta'), ''),
  nullif(btrim(e->>'sconto'), ''),
  nullif(btrim(e->>'indirizzo'), ''),
  nullif(btrim(e->>'orari'), ''),
  nullif(btrim(e->>'telefono'), ''),
  CASE WHEN e->>'validaFino' ~ '^\d{4}-\d{2}-\d{2}$' THEN (e->>'validaFino')::date END,
  CASE WHEN e->>'creataAt' ~ '^\d{4}-\d{2}-\d{2}T' THEN (e->>'creataAt')::timestamptz END,
  now()
FROM (
  -- Solo la riga 'sconti', e solo se è un elenco: una riga vuota o strana non copia niente
  SELECT "value"::jsonb AS elenco FROM "system_configs"
  WHERE "key" = 'sconti' AND btrim("value") LIKE '[%'
) c
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(c.elenco) = 'array' THEN c.elenco ELSE '[]'::jsonb END
) AS e
WHERE jsonb_typeof(e) = 'object';
