import 'dotenv/config';
import { db } from './server/database/client';
import { sql } from 'drizzle-orm';

async function migrate() {
  try {
    await db.execute(sql`CREATE TYPE "public"."contact_request_status" AS ENUM('PENDING', 'READ', 'RESOLVED');`);
    console.log('Enum created');
  } catch(e) {
    console.log('Enum error (might exist):', e.message);
  }

  try {
    await db.execute(sql`CREATE TABLE "contact_requests" (
      "id" text PRIMARY KEY NOT NULL,
      "name" varchar(150) NOT NULL,
      "email" varchar(255) NOT NULL,
      "phone" varchar(20),
      "message" text NOT NULL,
      "status" "contact_request_status" DEFAULT 'PENDING' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );`);
    console.log('Table created');
  } catch(e) {
    console.log('Table error:', e.message);
  }

  try {
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "pkg_stati_gin_idx" ON "packages" USING gin ("stati");`);
    console.log('Index pkg_stati_gin_idx created');
  } catch(e) {
    console.log('Index error:', e.message);
  }

  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    console.log('Extension pg_trgm created');
  } catch(e) {
    console.log('Extension error:', e.message);
  }

  try {
    await db.execute(sql`CREATE INDEX IF NOT EXISTS students_name_trgm_idx ON students USING gin ((lower(first_name || ' ' || last_name)) gin_trgm_ops);`);
    console.log('Index students_name_trgm_idx created');
  } catch(e) {
    console.log('Index error:', e.message);
  }

  try {
    await db.execute(sql`CREATE INDEX IF NOT EXISTS users_name_trgm_idx ON users USING gin ((lower(first_name || ' ' || last_name)) gin_trgm_ops);`);
    console.log('Index users_name_trgm_idx created');
  } catch(e) {
    console.log('Index error:', e.message);
  }
}

migrate().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
