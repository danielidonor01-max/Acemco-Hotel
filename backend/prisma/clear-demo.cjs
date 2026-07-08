/**
 * Clears all demo / transactional data so the system runs on real data only.
 * KEEPS configuration: users, roles, permissions, room types, rooms, menu
 * (categories + items) and settings. WIPES everything operational: guests,
 * reservations (+ check-ins/outs/folios/charges), companies + payments, orders,
 * inventory, assets, work orders, HR, payroll, finance and housekeeping.
 *
 * Uses node-postgres (Prisma's engine can't reach Supabase from this Windows
 * host). TRUNCATE ... CASCADE handles FK order; kept tables are never children
 * of wiped tables, so config is untouched.
 *
 * Run:  node prisma/clear-demo.cjs   (or: npm run db:clear-demo)
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function envVar(key) {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const line = env.split(/\r?\n/).find((l) => l.startsWith(key + '='));
  if (!line) throw new Error(`${key} not found in .env`);
  return line.slice(key.length + 1).replace(/^"|"$/g, '');
}

// Demo/transactional tables to wipe. Parents are enough — CASCADE clears children
// (check_ins/outs, folios, folio lines, order_items, payslips, …). We only list
// tables that exist to avoid errors on schema drift.
const WIPE = [
  'charge_ledger',
  'company_payments',
  'orders',
  'reservations',
  'guests',
  'companies',
  'housekeeping_tasks',
  'work_orders',
  'assets',
  'inventory_items',
  'leave_requests',
  'payroll_periods',
  'employees',
  'finance_transactions',
  'audit_logs',
];

async function main() {
  const client = new Client({ connectionString: envVar('DIRECT_URL'), ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase via pg.');

  const existing = (
    await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [WIPE],
    )
  ).rows.map((r) => r.table_name);
  const targets = WIPE.filter((t) => existing.includes(t));
  if (targets.length === 0) {
    console.log('No demo tables found to clear.');
    await client.end();
    return;
  }

  await client.query(`TRUNCATE ${targets.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  console.log(`Cleared demo data from: ${targets.join(', ')}.`);

  // Reconcile physical room status: no reservations means no occupancy — release
  // any OCCUPIED/RESERVED rooms back to AVAILABLE (maintenance states preserved).
  await client.query(`
    UPDATE rooms SET status='AVAILABLE'
    WHERE status IN ('OCCUPIED','RESERVED')`);

  const kept = ['permissions', 'roles', 'users', 'room_types', 'rooms', 'menu_categories', 'menu_items', 'settings'];
  const counts = {};
  for (const t of kept) {
    const r = await client.query(`SELECT to_regclass('public.${t}') AS x`);
    if (r.rows[0].x) counts[t] = (await client.query(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
  }
  console.log('Config kept:', counts);
  await client.end();
  console.log('Demo data cleared. The system now runs on real data only.');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
