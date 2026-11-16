-- Tre indici DOPPIONI: ognuno è identico (stessa colonna, stesso ordine, nessun filtro
-- parziale, stessa classe di operatori) all'indice che il vincolo UNIQUE della stessa
-- colonna ha già. Controllato in sola lettura su pg_index il 16/11/2026. Si tolgono solo
-- i doppioni: i vincoli unici restano, e con loro il loro indice, quindi le ricerche per
-- email, per giorno di chiusura e per pagamento tutor restano veloci come prima.
-- In più: ogni scrittura su quelle tabelle smette di aggiornare un indice inutile.
-- users_email_idx: doppione di users_email_unique (users.email)
DROP INDEX "users_email_idx";--> statement-breakpoint
-- acc_tutor_payment_idx: doppione di accounting_entries_tutor_payment_id_unique (accounting_entries.tutor_payment_id)
DROP INDEX "acc_tutor_payment_idx";--> statement-breakpoint
-- closure_date_idx: doppione di closure_dates_date_unique (closure_dates.date)
DROP INDEX "closure_date_idx";
