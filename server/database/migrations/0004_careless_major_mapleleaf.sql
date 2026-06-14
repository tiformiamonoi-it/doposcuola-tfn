CREATE INDEX "pkg_stati_gin_idx" ON "packages" USING gin ("stati");
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS students_name_trgm_idx ON students USING gin ((lower(first_name || ' ' || last_name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_name_trgm_idx ON users USING gin ((lower(first_name || ' ' || last_name)) gin_trgm_ops);