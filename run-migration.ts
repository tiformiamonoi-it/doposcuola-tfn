import 'dotenv/config';
import { db } from './server/database/client';
import { sql } from 'drizzle-orm';
import fs from 'fs';

async function run() {
  const file = fs.readFileSync('server/database/migrations/0006_past_quentin_quire.sql', 'utf-8');
  const statements = file.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

  for (const stmt of statements) {
    try {
      console.log('Executing:', stmt);
      await db.execute(sql.raw(stmt));
      console.log('Success');
    } catch (e) {
      console.error('Error on statement:', e.message);
    }
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) });
