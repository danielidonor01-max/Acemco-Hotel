/**
 * One-off provisioning via node-postgres (bypasses the Prisma query engine,
 * which cannot reach Supabase from this Windows host — Node's TLS can).
 * Applies the init migration, records it in _prisma_migrations (so Vercel's
 * `migrate deploy` is a no-op), then seeds. Idempotent.
 *
 * Run:  node prisma/provision.cjs
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

function envVar(key) {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const line = env.split(/\r?\n/).find((l) => l.startsWith(key + '='));
  if (!line) throw new Error(`${key} not found in .env`);
  return line.slice(key.length + 1).replace(/^"|"$/g, '');
}

const uuid = () => crypto.randomUUID();

// ---- seed data (mirrors prisma/seed/seed.ts) ----
const MODULE_ACTIONS = {
  auth: ['VIEW', 'CREATE'],
  rooms: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'],
  reservations: ['VIEW', 'CREATE', 'UPDATE', 'APPROVE'],
  reception: ['VIEW', 'CREATE'],
  guests: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'],
  'pos.restaurant': ['VIEW', 'CREATE', 'UPDATE'],
  'pos.lounge': ['VIEW', 'CREATE', 'UPDATE'],
  'pos.boutique': ['VIEW', 'CREATE', 'UPDATE'],
  inventory: ['VIEW', 'CREATE', 'UPDATE', 'APPROVE'],
  housekeeping: ['VIEW', 'CREATE', 'UPDATE'],
  maintenance: ['VIEW', 'CREATE', 'UPDATE', 'APPROVE'],
  hr: ['VIEW', 'CREATE', 'UPDATE', 'APPROVE'],
  payroll: ['VIEW', 'CREATE', 'APPROVE'],
  finance: ['VIEW', 'CREATE', 'APPROVE', 'EXPORT'],
  reports: ['VIEW', 'EXPORT'],
  cms: ['VIEW', 'UPDATE'],
  settings: ['VIEW', 'UPDATE'],
  administration: ['VIEW', 'UPDATE'],
};
const allPerms = () => Object.entries(MODULE_ACTIONS).flatMap(([m, as]) => as.map((a) => `${m}:${a}`));
const mods = (...names) => names.flatMap((m) => (MODULE_ACTIONS[m] || []).map((a) => `${m}:${a}`));
// system: true → locked (cannot be renamed or deleted). Default operational roles are
// editable/removable so hotel admins can remodel them from the Administration screen.
const ROLE_GRANTS = {
  SUPER_ADMIN: { description: 'Unrestricted access to all modules and settings.', system: true, perms: '*' },
  HOTEL_MANAGER: { description: 'Full operational access, no system settings.', system: true, perms: allPerms().filter((p) => p !== 'settings:UPDATE' && !p.startsWith('administration:')) },
  RECEPTION: { description: 'Reservations, check-in/out, and guest management.', system: true, perms: ['rooms:VIEW', 'rooms:UPDATE', 'reservations:VIEW', 'reservations:CREATE', 'reservations:UPDATE', 'reception:VIEW', 'reception:CREATE', 'guests:VIEW', 'guests:CREATE', 'guests:UPDATE', 'pos.restaurant:VIEW', 'pos.lounge:VIEW'] },
  'Inventory Manager': { description: 'Full inventory management and stock reporting.', system: false, perms: [...mods('inventory'), 'reports:VIEW'] },
  'POS Manager': { description: 'Restaurant, lounge, and boutique point of sale.', system: false, perms: [...mods('pos.restaurant', 'pos.lounge', 'pos.boutique'), 'inventory:VIEW', 'reports:VIEW'] },
  Maintenance: { description: 'Assets, work orders, and room maintenance.', system: false, perms: [...mods('maintenance'), 'rooms:VIEW', 'housekeeping:VIEW'] },
  HR: { description: 'Employee records, leave, and payroll view.', system: false, perms: [...mods('hr'), 'payroll:VIEW', 'reports:VIEW'] },
};
const ROOM_TYPES = [
  { slug: 'deluxe-king', name: 'Deluxe King', bed: '1 King Bed', occ: 2, price: 65000, features: ['City view', 'Marble bath', 'Fast Wi-Fi', 'Smart TV'], sort: 1 },
  { slug: 'twin-classic', name: 'Twin Classic', bed: '2 Twin Beds', occ: 2, price: 58000, features: ['Garden view', 'Fast Wi-Fi', 'Work desk'], sort: 2 },
  { slug: 'executive-suite', name: 'Executive Suite', bed: '1 King Bed + Sofa', occ: 3, price: 120000, features: ['Separate lounge', 'Private bar', 'City view'], sort: 3 },
  { slug: 'garden-family', name: 'Garden Family Room', bed: '1 King + 2 Single Beds', occ: 4, price: 95000, features: ['Courtyard access', 'Family layout', 'Fast Wi-Fi'], sort: 4 },
];
const STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'AVAILABLE', 'OCCUPIED', 'INSPECTION', 'AVAILABLE', 'MAINTENANCE', 'AVAILABLE', 'OCCUPIED', 'OUT_OF_ORDER', 'AVAILABLE', 'RESERVED', 'AVAILABLE', 'CLEANING', 'OCCUPIED', 'AVAILABLE', 'AVAILABLE', 'BLOCKED', 'OCCUPIED', 'AVAILABLE', 'INSPECTION', 'AVAILABLE'];
const MENU = [
  { sf: 'RESTAURANT', cat: 'Starters', items: [['Pepper Soup, Catfish', 'Aromatic broth, scent leaf, fresh catfish.', 6500, ['Spicy'], true], ['Suya Beef Skewers', 'Charred, dusted with yaji, red onion.', 7000, ['Spicy'], true], ['Garden Salad', 'Leaves, avocado, citrus dressing.', 5000, ['Vegetarian'], true]] },
  { sf: 'RESTAURANT', cat: 'Mains', items: [['Jollof Rice & Grilled Chicken', 'Smoky party jollof, chicken, plantain.', 9500, [], true], ['Seared Barramundi', 'Coconut sauce, greens, jasmine rice.', 14000, [], true], ['Egusi & Pounded Yam', 'Melon seed stew, assorted, pounded yam.', 11000, [], false], ['Ribeye, Pepper Glaze', '300g grass-fed, ata rodo glaze, fries.', 21000, ['Spicy'], true]] },
  { sf: 'LOUNGE', cat: 'Signatures', items: [['Marina Sundown', 'Aged rum, hibiscus, lime, bitters.', 8000, [], true], ['Smoked Old Fashioned', 'Bourbon, cane sugar, oak smoke.', 9000, [], true], ['Zobo Spritz', 'Hibiscus, sparkling, citrus. Zero proof.', 5500, ['Zero-proof'], true]] },
  { sf: 'LOUNGE', cat: 'Small Plates', items: [['Peppered Snails', 'Bell pepper, onion, scotch bonnet.', 8500, ['Spicy'], true], ['Plantain & Dip', 'Crisp plantain, smoked pepper dip.', 4500, ['Vegetarian'], true]] },
];

async function main() {
  const connectionString = envVar('DIRECT_URL');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase via pg.');

  // 1) Apply migration if not already provisioned.
  const exists = await client.query("SELECT to_regclass('public.users') AS t");
  if (!exists.rows[0].t) {
    const sqlPath = path.join(__dirname, 'migrations', '20260705000000_init', 'migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('Schema applied (migration.sql).');

    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      id varchar(36) PRIMARY KEY, checksum varchar(64) NOT NULL, finished_at timestamptz,
      migration_name varchar(255) NOT NULL, logs text, rolled_back_at timestamptz,
      started_at timestamptz NOT NULL DEFAULT now(), applied_steps_count integer NOT NULL DEFAULT 0)`);
    await client.query(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
       VALUES ($1,$2,now(),$3,1) ON CONFLICT DO NOTHING`,
      [uuid(), checksum, '20260705000000_init'],
    );
    console.log('Recorded migration in _prisma_migrations.');
  } else {
    console.log('Schema already present — skipping migration.');
  }

  // 2) Permissions
  const permId = {};
  for (const key of allPerms()) {
    const [module, action] = key.split(':');
    const id = uuid();
    const r = await client.query(
      `INSERT INTO permissions (id, module, action, description) VALUES ($1,$2,$3::"PermissionAction",$4)
       ON CONFLICT (module, action) DO UPDATE SET description = EXCLUDED.description RETURNING id`,
      [id, module, action, `${action} ${module}`],
    );
    permId[key] = r.rows[0].id;
  }

  // 3) Roles + role_permissions
  const roleId = {};
  for (const [name, def] of Object.entries(ROLE_GRANTS)) {
    const id = uuid();
    const r = await client.query(
      `INSERT INTO roles (id, name, description, is_system) VALUES ($1,$2,$3,$4)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_system = EXCLUDED.is_system RETURNING id`,
      [id, name, def.description, def.system === true],
    );
    roleId[name] = r.rows[0].id;
    const keys = def.perms === '*' ? allPerms() : def.perms;
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId[name]]);
    for (const k of keys) {
      if (permId[k]) await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [roleId[name], permId[k]]);
    }
  }

  // 4) Users — a single Super Admin seat. All other staff are created in-app
  //    from Administration → Users (no public signup exists).
  const hash = await bcrypt.hash('Admin123!', 10);
  const users = [
    { email: 'super@acemco.com', name: 'Super Admin', role: 'SUPER_ADMIN' },
  ];
  for (const u of users) {
    const id = uuid();
    const r = await client.query(
      `INSERT INTO users (id, email, password_hash, name, is_active, updated_at) VALUES ($1,$2,$3,$4,true,now())
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name RETURNING id`,
      [id, u.email, hash, u.name],
    );
    await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [r.rows[0].id, roleId[u.role]]);
  }
  // Remove legacy demo accounts so the Super Admin is the only seeded login.
  const keep = users.map((u) => u.email);
  const purged = await client.query('DELETE FROM users WHERE email = ANY($1::text[]) RETURNING email', [
    ['ada@acemcohotel.com', 'super@acemcohotel.com'].filter((e) => !keep.includes(e)),
  ]);
  if (purged.rowCount) console.log('Removed legacy demo users:', purged.rows.map((r) => r.email).join(', '));

  // 5) Room types + rooms
  const typeIds = [];
  for (const rt of ROOM_TYPES) {
    const id = uuid();
    const r = await client.query(
      `INSERT INTO room_types (id, slug, name, description, max_occupancy, bed_configuration, base_price, features, images, sort_order, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
       ON CONFLICT (slug) DO UPDATE SET base_price = EXCLUDED.base_price RETURNING id`,
      [id, rt.slug, rt.name, `${rt.name} — a warm, considered stay.`, rt.occ, rt.bed, rt.price, rt.features, [], rt.sort],
    );
    typeIds.push(r.rows[0].id);
  }
  for (let i = 0; i < STATUSES.length; i++) {
    const floor = Math.floor(i / 6) + 1;
    const roomNumber = String(floor * 100 + (i % 6) + 1);
    await client.query(
      `INSERT INTO rooms (id, room_number, floor, room_type_id, status, updated_at)
       VALUES ($1,$2,$3,$4,$5::"RoomStatus",now())
       ON CONFLICT (room_number) DO UPDATE SET status = EXCLUDED.status`,
      [uuid(), roomNumber, floor, typeIds[i % typeIds.length], STATUSES[i]],
    );
  }

  // 5b) One checked-in in-house guest (so website room-service ordering can be verified).
  const chk = await client.query("SELECT count(*)::int n FROM reservations WHERE status='CHECKED_IN'");
  if (chk.rows[0].n === 0) {
    const room = (await client.query("SELECT id, room_type_id FROM rooms WHERE room_number='101'")).rows[0];
    if (room) {
      const guestId = uuid();
      await client.query(
        `INSERT INTO guests (id, first_name, last_name, phone, email, is_vip, updated_at)
         VALUES ($1,'James','Morrison','+44 7700 900123','james.m@example.com',true,now()) ON CONFLICT DO NOTHING`,
        [guestId],
      );
      await client.query(
        `INSERT INTO reservations (id, reservation_number, guest_id, room_id, room_type_id, check_in_date, check_out_date,
           adults, children, status, source, total_amount, deposit_paid, confirmed_at, updated_at)
         VALUES ($1,'RES-2026-09001',$2,$3,$4, current_date - interval '1 day', current_date + interval '2 day',
           1,0,'CHECKED_IN','WEBSITE',195000,true,now(),now())`,
        [uuid(), guestId, room.id, room.room_type_id],
      );
      await client.query("UPDATE rooms SET status='OCCUPIED' WHERE id=$1", [room.id]);
      console.log('Seeded in-house guest: Room 101 · Morrison (for order verification).');
    }
  }

  // 6) Menus (reset + insert)
  await client.query('DELETE FROM order_items');
  await client.query('DELETE FROM menu_items');
  await client.query('DELETE FROM menu_categories');
  for (let c = 0; c < MENU.length; c++) {
    const cat = MENU[c];
    const catId = uuid();
    await client.query('INSERT INTO menu_categories (id, storefront, name, sort_order, is_active) VALUES ($1,$2::"Storefront",$3,$4,true)', [catId, cat.sf, cat.cat, c]);
    let s = 0;
    for (const [name, desc, price, tags, avail] of cat.items) {
      await client.query(
        `INSERT INTO menu_items (id, category_id, storefront, name, description, price, is_available, tags, sort_order)
         VALUES ($1,$2,$3::"Storefront",$4,$5,$6,$7,$8,$9)`,
        [uuid(), catId, cat.sf, name, desc, price, avail, tags, s++],
      );
    }
  }

  // Verify
  const counts = {};
  for (const t of ['permissions', 'roles', 'users', 'room_types', 'rooms', 'menu_categories', 'menu_items']) {
    counts[t] = (await client.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
  }
  console.log('Seeded counts:', counts);
  await client.end();
  console.log('Provisioning complete.');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
