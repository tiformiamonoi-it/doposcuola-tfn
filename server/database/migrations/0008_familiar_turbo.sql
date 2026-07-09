-- Converte lessons.data da timestamptz (istante) a date (giorno civile).
-- USING (...AT TIME ZONE 'Europe/Rome')::date: il giorno viene ricavato dall'orario di Roma,
-- così le lezioni esistenti — anche quelle salvate con lo sfasamento di fuso che mostrava il
-- giorno sbagliato — vengono ricondotte al giorno corretto (es. una lezione del 19 salvata come
-- 18 22:00 UTC torna a essere il 19).
ALTER TABLE "lessons" ALTER COLUMN "data" SET DATA TYPE date USING ("data" AT TIME ZONE 'Europe/Rome')::date;
