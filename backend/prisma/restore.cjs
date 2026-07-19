/**
 * Restore a backup .sql file into the database in ONE command — no psql needed.
 *
 *   node prisma/restore.cjs <path-to-backup.sql>
 *   npm run db:restore -- <path-to-backup.sql>
 *
 * Uses node-postgres (the same driver backup.cjs and provision.cjs use to reach
 * Supabase from Windows). It loads the DATA from the backup; the file is a single
 * transaction with `INSERT ... ON CONFLICT DO NOTHING`, so it's safe to re-run and
 * only fills in missing rows — it never deletes or overwrites anything.
 *
 * The backup contains data + enum types but NOT the tables, so the target database
 * must already have the schema. If it doesn't (a brand-new empty database), this
 * script says so and tells you the one command to run first (`npm run db:provision`).
 *
 * Target database = DIRECT_URL in backend/.env (or the DIRECT_URL env var). Point
 * that at wherever you're restoring TO before running.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function envVar(key) {
  if (process.env[key]) return process.env[key];
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    const line = env.split(/\r?\n/).find((l) => l.startsWith(key + '='));
    if (line) return line.slice(key.length + 1).replace(/^"|"$/g, '');
  }
  throw new Error(`${key} not set as an env var and not found in .env`);
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node prisma/restore.cjs <path-to-backup.sql>');
    console.error('(If the file is still encrypted, decrypt it first:');
    console.error("  gpg --batch --passphrase '<passphrase>' --decrypt backup.sql.gpg > backup.sql )");
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const conn = envVar('DIRECT_URL');
  // Show WHERE this is about to write (without the password), so a wrong target
  // is obvious before anything runs.
  let target = '(unknown)';
  try {
    const u = new URL(conn);
    target = `${u.host}${u.pathname}`;
  } catch {
    /* leave as unknown */
  }

  const sql = fs.readFileSync(file, 'utf8');
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Guard: the backup carries data, not tables. If the schema isn't there yet,
  // stop with a clear instruction rather than failing halfway through.
  const hasSchema = (await client.query(`SELECT to_regclass('public.reservations') AS t`)).rows[0].t;
  if (!hasSchema) {
    console.error(`\nThe target database (${target}) has no tables yet.`);
    console.error('Create the schema first, then re-run this:');
    console.error('  npm run db:provision');
    await client.end();
    process.exit(1);
  }

  console.log(`Restoring "${path.basename(file)}" into ${target} ...`);
  await client.query(sql); // the file is one BEGIN…COMMIT transaction
  console.log('Done. Data restored (existing rows were left untouched).');
  await client.end();
}

main().catch((e) => {
  console.error('RESTORE FAILED:', e.message);
  process.exit(1);
});
