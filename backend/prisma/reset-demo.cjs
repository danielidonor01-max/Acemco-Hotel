/**
 * Remove obvious test/demo artifacts left over from manual QA, without touching
 * the seeded baseline. Safe to run repeatedly.
 *
 * Run:  node prisma/reset-demo.cjs
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

async function main() {
  const client = new Client({ connectionString: envVar('DIRECT_URL'), ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected. Cleaning demo/test artifacts…');

  // 1) Test walk-in guests + their reservations/check-ins/folios (cascades handle children).
  const guests = await client.query(
    `SELECT id FROM guests WHERE (lower(first_name)='test' AND lower(last_name)='walkin') OR phone='+2348000001111'`,
  );
  for (const g of guests.rows) {
    const res = await client.query('SELECT id FROM reservations WHERE guest_id=$1', [g.id]);
    for (const r of res.rows) {
      await client.query('DELETE FROM charge_ledger WHERE reservation_id=$1', [r.id]);
      const cis = await client.query('SELECT id FROM check_ins WHERE reservation_id=$1', [r.id]);
      for (const ci of cis.rows) {
        const fol = await client.query('SELECT id FROM folios WHERE check_in_id=$1', [ci.id]);
        for (const f of fol.rows) await client.query('DELETE FROM folio_lines WHERE folio_id=$1', [f.id]);
        await client.query('DELETE FROM check_outs WHERE check_in_id=$1', [ci.id]);
        await client.query('DELETE FROM folios WHERE check_in_id=$1', [ci.id]);
      }
      await client.query('DELETE FROM check_ins WHERE reservation_id=$1', [r.id]);
      await client.query('DELETE FROM reservations WHERE id=$1', [r.id]);
    }
    await client.query('DELETE FROM guests WHERE id=$1', [g.id]);
  }
  console.log(`Removed ${guests.rowCount} test guest(s) and their stays.`);

  // 2) Test work orders (raised without an asset and without an assignee).
  const wo = await client.query(
    `DELETE FROM work_orders WHERE work_order_number NOT IN
       ('WO-2026-00018','WO-2026-00019','WO-2026-00020','WO-2026-00021')
       AND asset_id IS NULL AND assigned_to IS NULL RETURNING work_order_number`,
  );
  if (wo.rowCount) console.log('Removed test work orders:', wo.rows.map((r) => r.work_order_number).join(', '));

  // 3) Stray inventory test items.
  const inv = await client.query(`DELETE FROM inventory_items WHERE sku LIKE 'TEST-%' RETURNING sku`);
  if (inv.rowCount) console.log('Removed test inventory:', inv.rows.map((r) => r.sku).join(', '));

  await client.end();
  console.log('Demo cleanup complete.');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
