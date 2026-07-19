/**
 * Full database backup to a LOCAL file — no cloud, no Supabase tier required.
 *
 * Why this exists, and why it's plain SQL:
 *   - While the project is on Supabase's free tier there is NO restorable backup.
 *     If the database goes, every booking, naira and audit row goes with it. This
 *     is the only copy the hotel owns.
 *   - Some clients contractually require data held on their own premises. Point
 *     BACKUP_DIR at a mapped drive or an on-site server and this is that copy.
 *
 * It writes INSERTs rather than a pg_dump binary format on purpose: pg_dump isn't
 * installed on most Windows boxes, and a plain .sql file can be restored by
 * anything that speaks Postgres — including a future self-hosted server.
 *
 *   node prisma/backup.cjs                    → ./backups/acemco-<timestamp>.sql
 *   BACKUP_DIR="D:/acemco-backups" node prisma/backup.cjs
 *   BACKUP_KEEP=30 node prisma/backup.cjs     → prune to the newest 30
 *
 * Restore (destructive — into an EMPTY database):
 *   psql "<connection string>" -f acemco-<timestamp>.sql
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function envVar(key) {
  // A real environment variable wins — that's how CI (GitHub Actions) passes the
  // connection string, where there is no .env file on disk.
  if (process.env[key]) return process.env[key];
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    const line = env.split(/\r?\n/).find((l) => l.startsWith(key + '='));
    if (line) return line.slice(key.length + 1).replace(/^"|"$/g, '');
  }
  throw new Error(`${key} not set as an env var and not found in .env`);
}

/** Quote any Postgres value as a SQL literal. */
function lit(v, type) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    // Postgres array literal, e.g. ARRAY['a','b']::text[]
    if (!v.length) return `'{}'`;
    return `ARRAY[${v.map((x) => lit(x)).join(',')}]${type ? `::${type}` : ''}`;
  }
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  const dir = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');
  const keep = Number(process.env.BACKUP_KEEP || 0);
  fs.mkdirSync(dir, { recursive: true });

  const client = new Client({ connectionString: envVar('DIRECT_URL'), ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Enum types first — a restore into a fresh database needs them before the tables.
  // ::text matters — array_agg over pg's `name` type comes back as a raw string
  // ('{A,B}') because node-postgres has no parser for name[], so it never parses
  // to a JS array.
  const enums = await client.query(`
    SELECT t.typname, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' GROUP BY t.typname`);

  // Dependency order matters on restore: parents before children.
  const tables = (
    await client.query(`
      SELECT c.relname AS table_name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> '_prisma_migrations'
      ORDER BY c.relname`)
  ).rows.map((r) => r.table_name);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `acemco-${stamp}.sql`);
  const out = fs.createWriteStream(file, { encoding: 'utf8' });
  const w = (s) => out.write(s + '\n');

  w(`-- Acemco full backup — ${new Date().toISOString()}`);
  w(`-- Restore into an EMPTY database:  psql "<conn>" -f ${path.basename(file)}`);
  w('BEGIN;');
  w('SET session_replication_role = replica;  -- defer FK checks until COMMIT');
  w('');

  for (const e of enums.rows) {
    w(`DO $$ BEGIN CREATE TYPE "${e.typname}" AS ENUM (${e.labels.map((l) => `'${l}'`).join(',')}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  }
  w('');

  let grand = 0;
  const summary = [];
  for (const table of tables) {
    const cols = (
      await client.query(
        `SELECT column_name, udt_name, data_type FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
        [table],
      )
    ).rows;
    const { rows } = await client.query(`SELECT * FROM "${table}"`);
    summary.push({ table, rows: rows.length });
    grand += rows.length;
    if (!rows.length) continue;

    w(`-- ${table} (${rows.length} rows)`);
    const names = cols.map((c) => `"${c.column_name}"`).join(', ');
    for (const row of rows) {
      const vals = cols
        .map((c) => {
          const v = row[c.column_name];
          // ARRAY columns come back as JS arrays; keep their element type.
          const arrayType = c.data_type === 'ARRAY' ? `${c.udt_name.replace(/^_/, '')}[]` : undefined;
          return lit(v, arrayType);
        })
        .join(', ');
      w(`INSERT INTO "${table}" (${names}) VALUES (${vals}) ON CONFLICT DO NOTHING;`);
    }
    w('');
  }

  w('SET session_replication_role = DEFAULT;');
  w('COMMIT;');
  await new Promise((res) => out.end(res));
  await client.end();

  const kb = Math.round(fs.statSync(file).size / 1024);
  console.table(summary.filter((s) => s.rows > 0));
  console.log(`\nBackup written: ${file}`);
  console.log(`${grand} rows across ${summary.filter((s) => s.rows > 0).length} tables · ${kb} KB`);

  if (keep > 0) {
    const old = fs
      .readdirSync(dir)
      .filter((f) => /^acemco-.*\.sql$/.test(f))
      .sort()
      .reverse()
      .slice(keep);
    old.forEach((f) => fs.unlinkSync(path.join(dir, f)));
    if (old.length) console.log(`Pruned ${old.length} older backup(s), keeping the newest ${keep}.`);
  }

  // A backup nobody checks is a backup that doesn't exist.
  if (grand === 0) {
    console.warn('\n⚠  The database is EMPTY — this backup contains no data. If that is unexpected, STOP and investigate.');
    process.exit(2);
  }
}

main().catch((e) => {
  console.error('BACKUP FAILED:', e.message);
  process.exit(1);
});
