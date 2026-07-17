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
// A real hotel's rooms start sellable. This used to seed a spread of
// CLEANING/INSPECTION/MAINTENANCE/OUT_OF_ORDER/BLOCKED for demo colour, which took
// 7 of 24 rooms out of inventory with NO housekeeping task or work order behind
// them — the invariant is that a non-AVAILABLE status must be backed by a record
// explaining it. That noise is demo data, so it lives behind SEED_DEMO now.
const DEMO_STATUSES = ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'CLEANING', 'AVAILABLE', 'AVAILABLE', 'INSPECTION', 'AVAILABLE', 'MAINTENANCE', 'AVAILABLE', 'AVAILABLE', 'OUT_OF_ORDER', 'AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'CLEANING', 'AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'BLOCKED', 'AVAILABLE', 'AVAILABLE', 'INSPECTION', 'AVAILABLE'];
const ROOM_COUNT = DEMO_STATUSES.length;
const MENU = [
  { sf: 'RESTAURANT', cat: 'Starters', items: [['Pepper Soup, Catfish', 'Aromatic broth, scent leaf, fresh catfish.', 6500, ['Spicy'], true], ['Suya Beef Skewers', 'Charred, dusted with yaji, red onion.', 7000, ['Spicy'], true], ['Garden Salad', 'Leaves, avocado, citrus dressing.', 5000, ['Vegetarian'], true]] },
  { sf: 'RESTAURANT', cat: 'Mains', items: [['Jollof Rice & Grilled Chicken', 'Smoky party jollof, chicken, plantain.', 9500, [], true], ['Seared Barramundi', 'Coconut sauce, greens, jasmine rice.', 14000, [], true], ['Egusi & Pounded Yam', 'Melon seed stew, assorted, pounded yam.', 11000, [], false], ['Ribeye, Pepper Glaze', '300g grass-fed, ata rodo glaze, fries.', 21000, ['Spicy'], true]] },
  { sf: 'LOUNGE', cat: 'Signatures', items: [['Marina Sundown', 'Aged rum, hibiscus, lime, bitters.', 8000, [], true], ['Smoked Old Fashioned', 'Bourbon, cane sugar, oak smoke.', 9000, [], true], ['Zobo Spritz', 'Hibiscus, sparkling, citrus. Zero proof.', 5500, ['Zero-proof'], true]] },
  { sf: 'LOUNGE', cat: 'Small Plates', items: [['Peppered Snails', 'Bell pepper, onion, scotch bonnet.', 8500, ['Spicy'], true], ['Plantain & Dip', 'Crisp plantain, smoked pepper dip.', 4500, ['Vegetarian'], true]] },
  { sf: 'BOUTIQUE', cat: 'Boutique', items: [['Signature Candle', 'Hand-poured soy candle, house scent.', 6000, ['Retail'], true], ['Acemco Tote', 'Heavy canvas tote, gold print.', 9000, ['Retail'], true], ['Travel Amenity Kit', 'Curated toiletries in a zip pouch.', 7500, ['Retail'], true]] },
];

// Demo/sample business data (guests, inventory, HR, finance, companies, …) is
// seeded ONLY when SEED_DEMO=true. By default provisioning sets up schema +
// config (permissions, roles, super admin, room types, rooms, menu, settings)
// and leaves the operational tables empty so the system runs on real data.
const SEED_DEMO = process.env.SEED_DEMO === 'true';

async function main() {
  const connectionString = envVar('DIRECT_URL');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Connected to Supabase via pg.${SEED_DEMO ? ' (SEED_DEMO on)' : ''}`);

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

  // 1b) Extended operational module tables (inventory, maintenance, HR, payroll,
  //     finance, housekeeping). Idempotent DDL — safe to run repeatedly.
  const ENUMS = {
    InventoryDepartment: ['RESTAURANT', 'LOUNGE', 'BOUTIQUE', 'HOUSEKEEPING', 'MAINTENANCE', 'OFFICE', 'GENERAL'],
    AssetStatus: ['OPERATIONAL', 'INSPECTION_DUE', 'NEEDS_REPAIR', 'UNDER_REPAIR', 'DECOMMISSIONED'],
    AssetArea: ['ROOM', 'POOL', 'BAR', 'RESTAURANT', 'RECEPTION', 'GYM', 'LOUNGE', 'KITCHEN', 'EXTERIOR', 'BACK_OF_HOUSE', 'OTHER'],
    WorkOrderType: ['CORRECTIVE', 'PREVENTIVE', 'INSPECTION'],
    WorkOrderPriority: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'],
    WorkOrderStatus: ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'],
    EmploymentType: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
    EmployeeStatus: ['ACTIVE', 'SUSPENDED', 'TERMINATED', 'RESIGNED'],
    LeaveType: ['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'UNPAID', 'COMPASSIONATE'],
    LeaveStatus: ['PENDING', 'APPROVED', 'REJECTED'],
    PayrollStatus: ['DRAFT', 'PROCESSING', 'APPROVED', 'PAID', 'CLOSED'],
    TransactionType: ['REVENUE', 'EXPENSE', 'PAYROLL', 'REFUND'],
    TransactionDirection: ['DEBIT', 'CREDIT'],
    TransactionStatus: ['PENDING', 'POSTED', 'VOIDED'],
    HousekeepingType: ['CHECKOUT_CLEAN', 'STAYOVER_CLEAN', 'DEEP_CLEAN', 'INSPECTION', 'TURNDOWN'],
    HousekeepingStatus: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
    HousekeepingPriority: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
    ReservationType: ['INDIVIDUAL', 'CORPORATE', 'CONFERENCE'],
    GuestTier: ['STANDARD', 'PREFERRED', 'VIP'],
    CompanyTier: ['STANDARD', 'PREFERRED', 'VIP', 'STRATEGIC'],
    CompanyStatus: ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
    ChargeDepartment: ['ROOM', 'RESTAURANT', 'LOUNGE', 'BOUTIQUE', 'LAUNDRY', 'CONFERENCE', 'DAMAGE', 'SERVICE', 'DISCOUNT', 'TAX', 'OTHER'],
    ChargeStatus: ['PENDING', 'POSTED', 'VOIDED', 'INVOICED', 'PAID'],
  };
  for (const [name, values] of Object.entries(ENUMS)) {
    const vals = values.map((v) => `'${v}'`).join(', ');
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${name}') THEN
        CREATE TYPE "${name}" AS ENUM (${vals});
      END IF;
    END $$;`);
  }
  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id text PRIMARY KEY, name text NOT NULL, sku text NOT NULL UNIQUE,
      department "InventoryDepartment" NOT NULL DEFAULT 'GENERAL', unit text NOT NULL,
      current_qty integer NOT NULL DEFAULT 0, min_stock_level integer NOT NULL DEFAULT 0,
      unit_cost numeric(12,2) NOT NULL DEFAULT 0, location text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS assets (
      id text PRIMARY KEY, asset_number text NOT NULL UNIQUE, name text NOT NULL, category text NOT NULL,
      location text NOT NULL, status "AssetStatus" NOT NULL DEFAULT 'OPERATIONAL', next_inspection date,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS work_orders (
      id text PRIMARY KEY, work_order_number text NOT NULL UNIQUE, asset_id text REFERENCES assets(id),
      type "WorkOrderType" NOT NULL DEFAULT 'CORRECTIVE', priority "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
      status "WorkOrderStatus" NOT NULL DEFAULT 'OPEN', assigned_to text, estimated_cost numeric(12,2) NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS employees (
      id text PRIMARY KEY, employee_number text NOT NULL UNIQUE, name text NOT NULL, department text NOT NULL,
      position text NOT NULL, employment_type "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
      status "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE', start_date date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS leave_requests (
      id text PRIMARY KEY, employee_id text NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      type "LeaveType" NOT NULL DEFAULT 'ANNUAL', start_date date NOT NULL, end_date date NOT NULL,
      days integer NOT NULL DEFAULT 1, status "LeaveStatus" NOT NULL DEFAULT 'PENDING',
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS payroll_periods (
      id text PRIMARY KEY, period_name text NOT NULL, start_date date NOT NULL, end_date date NOT NULL,
      status "PayrollStatus" NOT NULL DEFAULT 'DRAFT', total_gross numeric(14,2) NOT NULL DEFAULT 0,
      total_net numeric(14,2) NOT NULL DEFAULT 0, headcount integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id text PRIMARY KEY, transaction_number text NOT NULL UNIQUE, type "TransactionType" NOT NULL,
      amount numeric(14,2) NOT NULL, direction "TransactionDirection" NOT NULL, account text NOT NULL,
      description text NOT NULL, date date NOT NULL, status "TransactionStatus" NOT NULL DEFAULT 'PENDING',
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS housekeeping_tasks (
      id text PRIMARY KEY, room_number text NOT NULL, type "HousekeepingType" NOT NULL DEFAULT 'CHECKOUT_CLEAN',
      status "HousekeepingStatus" NOT NULL DEFAULT 'PENDING', priority "HousekeepingPriority" NOT NULL DEFAULT 'NORMAL',
      assigned_to text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS settings (
      id text PRIMARY KEY, hotel_name text NOT NULL, tagline text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
      whatsapp text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', city text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now());
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS area "AssetArea" NOT NULL DEFAULT 'OTHER';
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS room_number text;
    CREATE TABLE IF NOT EXISTS companies (
      id text PRIMARY KEY, name text NOT NULL UNIQUE, contact_name text, email text, phone text, address text,
      billing_email text, tier "CompanyTier" NOT NULL DEFAULT 'STANDARD', status "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
      notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    ALTER TABLE guests ADD COLUMN IF NOT EXISTS tier "GuestTier" NOT NULL DEFAULT 'STANDARD';
    ALTER TABLE guests ADD COLUMN IF NOT EXISTS whatsapp text;
    UPDATE guests SET tier='VIP' WHERE is_vip = true AND tier='STANDARD';
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS type "ReservationType" NOT NULL DEFAULT 'INDIVIDUAL';
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS company_id text REFERENCES companies(id);
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,2) NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS charge_ledger (
      id text PRIMARY KEY, charge_number text NOT NULL UNIQUE,
      reservation_id text REFERENCES reservations(id), guest_id text REFERENCES guests(id),
      company_id text REFERENCES companies(id), room_id text REFERENCES rooms(id),
      department "ChargeDepartment" NOT NULL, source_module text NOT NULL, reference_number text,
      description text NOT NULL, amount numeric(12,2) NOT NULL, tax numeric(12,2) NOT NULL DEFAULT 0,
      status "ChargeStatus" NOT NULL DEFAULT 'POSTED', date date NOT NULL DEFAULT current_date,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS charge_ledger_company_idx ON charge_ledger(company_id);
    CREATE INDEX IF NOT EXISTS charge_ledger_guest_idx ON charge_ledger(guest_id);
    CREATE INDEX IF NOT EXISTS charge_ledger_reservation_idx ON charge_ledger(reservation_id);
    CREATE INDEX IF NOT EXISTS charge_ledger_status_idx ON charge_ledger(status);
    CREATE TABLE IF NOT EXISTS company_payments (
      id text PRIMARY KEY, company_id text NOT NULL REFERENCES companies(id),
      amount numeric(12,2) NOT NULL, method "PaymentMethod" NOT NULL DEFAULT 'TRANSFER',
      reference text, note text, recorded_by_user_id text,
      paid_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS company_payments_company_idx ON company_payments(company_id);
    -- Tax/levy configuration. Rates are data so the till, the folio, Finance and the
    -- filing report all read one source instead of a hardcoded constant.
    CREATE TABLE IF NOT EXISTS tax_rates (
      id text PRIMARY KEY, name text NOT NULL, code text NOT NULL UNIQUE,
      rate numeric(6,3) NOT NULL, applies_to "ChargeDepartment"[] NOT NULL DEFAULT '{}',
      is_inclusive boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    -- Orders record the tax they charged so a till total is always reproducible.
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_amount numeric(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2) NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS reservations_company_idx ON reservations(company_id);
    CREATE INDEX IF NOT EXISTS assets_area_idx ON assets(area);
    CREATE INDEX IF NOT EXISTS work_orders_asset_id_idx ON work_orders(asset_id);
    CREATE INDEX IF NOT EXISTS leave_requests_employee_id_idx ON leave_requests(employee_id);
    CREATE INDEX IF NOT EXISTS finance_transactions_type_idx ON finance_transactions(type);
    CREATE INDEX IF NOT EXISTS finance_transactions_status_idx ON finance_transactions(status);
  `);
  console.log('Extended module tables ensured.');

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
  const STATUSES = SEED_DEMO ? DEMO_STATUSES : Array(ROOM_COUNT).fill('AVAILABLE');
  for (let i = 0; i < ROOM_COUNT; i++) {
    const floor = Math.floor(i / 6) + 1;
    const roomNumber = String(floor * 100 + (i % 6) + 1);
    await client.query(
      // DO NOTHING on conflict: an existing room's status is OPERATIONAL truth, not
      // config. This used to overwrite it from the array above on every run — so
      // re-provisioning a live hotel would reset an OCCUPIED room to AVAILABLE and
      // let reception sell it out from under the guest sleeping in it.
      `INSERT INTO rooms (id, room_number, floor, room_type_id, status, updated_at)
       VALUES ($1,$2,$3,$4,$5::"RoomStatus",now())
       ON CONFLICT (room_number) DO NOTHING`,
      [uuid(), roomNumber, floor, typeIds[i % typeIds.length], STATUSES[i]],
    );
  }

  // 5b) One checked-in in-house guest (demo only — so website room-service ordering can be verified).
  const chk = await client.query("SELECT count(*)::int n FROM reservations WHERE status='CHECKED_IN'");
  if (SEED_DEMO && chk.rows[0].n === 0) {
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

  // 5c) Ensure every CHECKED_IN reservation has a CheckIn + OPEN folio with the room
  //     charge posted (backfills guests seeded before folios existed). Idempotent.
  const superId = (await client.query("SELECT id FROM users WHERE email='super@acemco.com'")).rows[0]?.id;
  if (superId) {
    const needFolio = await client.query(`
      SELECT r.id, r.guest_id, r.room_id, r.reservation_number, r.total_amount
      FROM reservations r
      WHERE r.status='CHECKED_IN' AND r.room_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM check_ins ci WHERE ci.reservation_id = r.id)`);
    for (const r of needFolio.rows) {
      const checkInId = uuid();
      await client.query(
        `INSERT INTO check_ins (id, reservation_id, guest_id, room_id, checked_in_by_user_id, key_issued, checked_in_at)
         VALUES ($1,$2,$3,$4,$5,true,now())`,
        [checkInId, r.id, r.guest_id, r.room_id, superId],
      );
      const folioId = uuid();
      await client.query(
        `INSERT INTO folios (id, guest_id, check_in_id, status, opened_at) VALUES ($1,$2,$3,'OPEN',now())`,
        [folioId, r.guest_id, checkInId],
      );
    }
    if (needFolio.rowCount) console.log(`Backfilled folios for ${needFolio.rowCount} in-house reservation(s).`);

    // Ensure a ROOM charge exists in the Charge Ledger for each checked-in stay.
    const needRoomCharge = await client.query(`
      SELECT r.id, r.guest_id, r.room_id, r.company_id, r.reservation_number, r.total_amount
      FROM reservations r
      WHERE r.status='CHECKED_IN'
        AND NOT EXISTS (SELECT 1 FROM charge_ledger cl WHERE cl.reservation_id = r.id AND cl.department='ROOM')`);
    for (const r of needRoomCharge.rows) {
      const n = (await client.query('SELECT count(*)::int n FROM charge_ledger')).rows[0].n;
      await client.query(
        `INSERT INTO charge_ledger (id, charge_number, reservation_id, guest_id, company_id, room_id, department, source_module, reference_number, description, amount, tax, status, date, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'ROOM','reservations',$7,$8,$9,0,'POSTED',current_date,now())`,
        [uuid(), `CHG-2026-${String(n + 1).padStart(5, '0')}`, r.id, r.guest_id, r.company_id, r.room_id, r.reservation_number, `Room charge · ${r.reservation_number}`, r.total_amount],
      );
    }
    if (needRoomCharge.rowCount) console.log(`Backfilled ${needRoomCharge.rowCount} room charge(s) into the ledger.`);
  }

  // 5d) Reconcile physical room occupancy with reservations: a room is OCCUPIED only when a
  //     checked-in reservation holds it. Clears stray OCCUPIED/RESERVED from earlier seeds so
  //     the rooms board never disagrees with reservation-driven availability. Out-of-service
  //     statuses (maintenance/out-of-order/blocked) are preserved.
  await client.query(`
    UPDATE rooms SET status='AVAILABLE'
    WHERE status IN ('OCCUPIED','RESERVED')
      AND id NOT IN (SELECT room_id FROM reservations WHERE room_id IS NOT NULL AND status='CHECKED_IN')`);
  await client.query(`
    UPDATE rooms SET status='OCCUPIED'
    WHERE status NOT IN ('OUT_OF_ORDER','MAINTENANCE','BLOCKED')
      AND id IN (SELECT room_id FROM reservations WHERE room_id IS NOT NULL AND status='CHECKED_IN')`);
  console.log('Reconciled room occupancy with checked-in reservations.');

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

  // 7) Settings (config — always seeded so the hotel identity/contact exists).
  await client.query(
    `INSERT INTO settings (id, hotel_name, tagline, phone, whatsapp, email, address, city, updated_at)
     VALUES ('hotel','Acemco Express','Holiday Inn','+234 807 712 5775','2348077125775','','12 Marina Crescent','Warri, Delta State, Nigeria',now())
     ON CONFLICT (id) DO NOTHING`,
  );
  // One-time correction: the row was first seeded with placeholder contact details
  // (+234 800 000 0000 / a domain the hotel doesn't own). Those went live as real,
  // clickable contact points. Overwrite the placeholders — but never a real value an
  // operator has since set.
  await client.query(
    `UPDATE settings SET phone='+234 807 712 5775', whatsapp='2348077125775', updated_at=now()
      WHERE id='hotel' AND (phone LIKE '%800 000 0000%' OR whatsapp='2348000000000')`,
  );
  await client.query(
    `UPDATE settings SET email='', updated_at=now() WHERE id='hotel' AND email='reservations@acemcohotel.com'`,
  );

  // 7a) Tax configuration (config — the hotel must be able to bill lawfully on day one).
  // Nigerian VAT is 7.5% and is charged ON TOP of the listed price. Seeded once;
  // edit it in Manage → Tax & Compliance, never here. Departments deliberately
  // excluded: OTHER (deposits/prepaid credits), DISCOUNT, TAX itself, DAMAGE, SERVICE.
  await client.query(
    `INSERT INTO tax_rates (id, name, code, rate, applies_to, is_inclusive, is_active, sort_order, created_at, updated_at)
     VALUES (gen_random_uuid()::text, 'VAT', 'VAT', 7.5,
             ARRAY['ROOM','RESTAURANT','LOUNGE','BOUTIQUE','LAUNDRY','CONFERENCE']::"ChargeDepartment"[],
             false, true, 0, now(), now())
     ON CONFLICT (code) DO NOTHING`,
  );

  // 7b) Demo/sample operational data — seeded only when SEED_DEMO=true (default off).
  if (SEED_DEMO) {
  const INVENTORY = [
    ['Basmati Rice', 'RST-RICE-01', 'RESTAURANT', 'kg', 8, 20, 2200, 'Dry Store A'],
    ['Chicken (whole)', 'RST-CHKN-02', 'RESTAURANT', 'kg', 45, 30, 3500, 'Cold Room 1'],
    ['Aged Rum', 'LNG-RUM-03', 'LOUNGE', 'bottle', 6, 12, 14000, 'Bar Store'],
    ['Tonic Water', 'LNG-TNC-04', 'LOUNGE', 'can', 120, 48, 500, 'Bar Store'],
    ['Bath Towels', 'HK-TWL-05', 'HOUSEKEEPING', 'piece', 60, 80, 3000, 'Linen Room'],
    ['All-purpose Cleaner', 'HK-CLN-06', 'HOUSEKEEPING', 'litre', 22, 15, 1200, 'Housekeeping Store'],
    ['LED Bulbs 9W', 'MNT-BLB-07', 'MAINTENANCE', 'piece', 14, 20, 900, 'Workshop'],
    ['A4 Paper Ream', 'OFF-PPR-08', 'OFFICE', 'ream', 30, 10, 3500, 'Admin Store'],
    ['Signature Candle (retail)', 'BTQ-CDL-09', 'BOUTIQUE', 'piece', 24, 10, 6000, 'Boutique'],
    ['Coffee Beans', 'RST-COF-10', 'RESTAURANT', 'kg', 3, 8, 8000, 'Dry Store A'],
  ];
  for (const [name, sku, dept, unit, qty, min, cost, loc] of INVENTORY) {
    await client.query(
      `INSERT INTO inventory_items (id, name, sku, department, unit, current_qty, min_stock_level, unit_cost, location, updated_at)
       VALUES ($1,$2,$3,$4::"InventoryDepartment",$5,$6,$7,$8,$9,now())
       ON CONFLICT (sku) DO UPDATE SET current_qty = EXCLUDED.current_qty, min_stock_level = EXCLUDED.min_stock_level, unit_cost = EXCLUDED.unit_cost`,
      [uuid(), name, sku, dept, unit, qty, min, cost, loc],
    );
  }

  // [assetNumber, name, category, area, roomNumber, location, status, nextInspection]
  const ASSETS = [
    ['AST-0042', 'Generator — Main', 'Power', 'BACK_OF_HOUSE', null, 'Basement', 'OPERATIONAL', '2026-08-01'],
    ['AST-0043', 'Chiller Unit 1', 'HVAC', 'BACK_OF_HOUSE', null, 'Roof', 'INSPECTION_DUE', '2026-07-10'],
    ['AST-0044', 'Elevator A', 'Vertical Transport', 'RECEPTION', null, 'Core', 'NEEDS_REPAIR', '2026-07-06'],
    ['AST-0045', 'Pool Pump', 'Leisure', 'POOL', null, 'Rooftop', 'UNDER_REPAIR', '2026-07-15'],
    ['AST-0046', 'Kitchen Extractor', 'Kitchen', 'KITCHEN', null, 'Restaurant', 'OPERATIONAL', '2026-09-01'],
    ['AST-0047', 'Split AC Unit', 'HVAC', 'ROOM', '101', 'Room 101', 'OPERATIONAL', '2026-09-15'],
    ['AST-0048', 'Smart TV 55"', 'Electronics', 'ROOM', '101', 'Room 101', 'OPERATIONAL', '2026-10-01'],
  ];
  const assetIdByName = {};
  for (const [num, name, cat, area, roomNumber, loc, status, next] of ASSETS) {
    const r = await client.query(
      `INSERT INTO assets (id, asset_number, name, category, area, room_number, location, status, next_inspection, updated_at)
       VALUES ($1,$2,$3,$4,$5::"AssetArea",$6,$7,$8::"AssetStatus",$9,now())
       ON CONFLICT (asset_number) DO UPDATE SET status = EXCLUDED.status, area = EXCLUDED.area, room_number = EXCLUDED.room_number, next_inspection = EXCLUDED.next_inspection RETURNING id`,
      [uuid(), num, name, cat, area, roomNumber, loc, status, next],
    );
    assetIdByName[name] = r.rows[0].id;
  }
  const WORK_ORDERS = [
    ['WO-2026-00018', 'Elevator A', 'CORRECTIVE', 'CRITICAL', 'OPEN', 'Ibrahim K.', 180000],
    ['WO-2026-00019', 'Chiller Unit 1', 'INSPECTION', 'NORMAL', 'IN_PROGRESS', 'Femi O.', 25000],
    ['WO-2026-00020', 'Pool Pump', 'CORRECTIVE', 'HIGH', 'IN_PROGRESS', 'Ibrahim K.', 60000],
    ['WO-2026-00021', 'Generator — Main', 'PREVENTIVE', 'NORMAL', 'COMPLETED', 'Femi O.', 40000],
  ];
  for (const [num, asset, type, priority, status, who, cost] of WORK_ORDERS) {
    await client.query(
      `INSERT INTO work_orders (id, work_order_number, asset_id, type, priority, status, assigned_to, estimated_cost, updated_at)
       VALUES ($1,$2,$3,$4::"WorkOrderType",$5::"WorkOrderPriority",$6::"WorkOrderStatus",$7,$8,now())
       ON CONFLICT (work_order_number) DO UPDATE SET status = EXCLUDED.status, priority = EXCLUDED.priority`,
      [uuid(), num, assetIdByName[asset] ?? null, type, priority, status, who, cost],
    );
  }

  const EMPLOYEES = [
    ['EMP-0042', 'Blessing Aigbe', 'Housekeeping', 'Room Attendant', 'FULL_TIME', 'ACTIVE', '2024-03-01'],
    ['EMP-0043', 'Emeka Nwosu', 'Housekeeping', 'Supervisor', 'FULL_TIME', 'ACTIVE', '2023-06-15'],
    ['EMP-0044', 'Ada Okoro', 'Management', 'Hotel Manager', 'FULL_TIME', 'ACTIVE', '2022-01-10'],
    ['EMP-0045', 'Ibrahim Kabir', 'Maintenance', 'Technician', 'FULL_TIME', 'ACTIVE', '2024-09-01'],
    ['EMP-0046', 'Chidi Eze', 'Restaurant', 'Chef de Partie', 'FULL_TIME', 'ACTIVE', '2023-11-20'],
    ['EMP-0047', 'Halima Sani', 'Front Desk', 'Receptionist', 'PART_TIME', 'ACTIVE', '2025-02-01'],
    ['EMP-0048', 'Peter Obi', 'Lounge', 'Bartender', 'CONTRACT', 'SUSPENDED', '2024-07-05'],
  ];
  const empIdByName = {};
  for (const [num, name, dept, pos, type, status, start] of EMPLOYEES) {
    const r = await client.query(
      `INSERT INTO employees (id, employee_number, name, department, position, employment_type, status, start_date, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::"EmploymentType",$7::"EmployeeStatus",$8,now())
       ON CONFLICT (employee_number) DO UPDATE SET status = EXCLUDED.status, department = EXCLUDED.department, position = EXCLUDED.position RETURNING id`,
      [uuid(), num, name, dept, pos, type, status, start],
    );
    empIdByName[name] = r.rows[0].id;
  }
  if ((await client.query('SELECT count(*)::int n FROM leave_requests')).rows[0].n === 0) {
    const LEAVE = [
      ['Halima Sani', 'ANNUAL', '2026-07-14', '2026-07-18', 5, 'PENDING'],
      ['Chidi Eze', 'SICK', '2026-07-05', '2026-07-06', 2, 'APPROVED'],
      ['Blessing Aigbe', 'COMPASSIONATE', '2026-07-20', '2026-07-22', 3, 'PENDING'],
    ];
    for (const [emp, type, start, end, days, status] of LEAVE) {
      if (empIdByName[emp]) await client.query(
        `INSERT INTO leave_requests (id, employee_id, type, start_date, end_date, days, status, updated_at)
         VALUES ($1,$2,$3::"LeaveType",$4,$5,$6,$7::"LeaveStatus",now())`,
        [uuid(), empIdByName[emp], type, start, end, days, status],
      );
    }
  }

  if ((await client.query('SELECT count(*)::int n FROM payroll_periods')).rows[0].n === 0) {
    const PAYROLL = [
      ['June 2026', '2026-06-01', '2026-06-30', 'PAID', 8400000, 7140000, 42],
      ['July 2026', '2026-07-01', '2026-07-31', 'PROCESSING', 8550000, 7267500, 43],
    ];
    for (const [name, start, end, status, gross, net, hc] of PAYROLL) {
      await client.query(
        `INSERT INTO payroll_periods (id, period_name, start_date, end_date, status, total_gross, total_net, headcount, updated_at)
         VALUES ($1,$2,$3,$4,$5::"PayrollStatus",$6,$7,$8,now())`,
        [uuid(), name, start, end, status, gross, net, hc],
      );
    }
  }

  const TXNS = [
    ['TXN-2026-04821', 'REVENUE', 480000, 'CREDIT', 'Room Revenue', 'Reservation RES-2026-00042', '2026-07-05', 'POSTED'],
    ['TXN-2026-04822', 'REVENUE', 25500, 'CREDIT', 'F&B Revenue', 'Order REST-2026-00219', '2026-07-05', 'POSTED'],
    ['TXN-2026-04823', 'EXPENSE', 180000, 'DEBIT', 'Repairs & Maintenance', 'WO-2026-00018 Elevator', '2026-07-05', 'PENDING'],
    ['TXN-2026-04824', 'EXPENSE', 96000, 'DEBIT', 'Utilities', 'Diesel supply', '2026-07-04', 'POSTED'],
    ['TXN-2026-04825', 'REVENUE', 24500, 'CREDIT', 'F&B Revenue', 'Order LNGE-2026-00061', '2026-07-05', 'POSTED'],
    ['TXN-2026-04826', 'REFUND', 58000, 'DEBIT', 'Room Revenue', 'Cancellation RES-2026-00053', '2026-07-05', 'POSTED'],
    ['TXN-2026-04827', 'PAYROLL', 7140000, 'DEBIT', 'Salaries', 'June 2026 payroll', '2026-06-30', 'POSTED'],
  ];
  for (const [num, type, amount, dir, account, desc, date, status] of TXNS) {
    await client.query(
      `INSERT INTO finance_transactions (id, transaction_number, type, amount, direction, account, description, date, status, updated_at)
       VALUES ($1,$2,$3::"TransactionType",$4,$5::"TransactionDirection",$6,$7,$8,$9::"TransactionStatus",now())
       ON CONFLICT (transaction_number) DO UPDATE SET status = EXCLUDED.status, amount = EXCLUDED.amount`,
      [uuid(), num, type, amount, dir, account, desc, date, status],
    );
  }

  if ((await client.query('SELECT count(*)::int n FROM housekeeping_tasks')).rows[0].n === 0) {
    const TASKS = [
      ['203', 'CHECKOUT_CLEAN', 'IN_PROGRESS', 'HIGH', 'Blessing A.'],
      ['116', 'INSPECTION', 'PENDING', 'NORMAL', 'Emeka N.'],
      ['301', 'STAYOVER_CLEAN', 'PENDING', 'NORMAL', null],
      ['512', 'TURNDOWN', 'COMPLETED', 'LOW', 'Blessing A.'],
    ];
    for (const [room, type, status, priority, who] of TASKS) {
      await client.query(
        `INSERT INTO housekeeping_tasks (id, room_number, type, status, priority, assigned_to, updated_at)
         VALUES ($1,$2,$3::"HousekeepingType",$4::"HousekeepingStatus",$5::"HousekeepingPriority",$6,now())`,
        [uuid(), room, type, status, priority, who],
      );
    }
  }

  // Corporate accounts (companies that book and are invoiced).
  const COMPANIES = [
    ['Chevron Nigeria', 'STRATEGIC', 'accounts@chevron.example', '+234 802 100 0001'],
    ['Shell Petroleum', 'VIP', 'ap@shell.example', '+234 802 100 0002'],
    ['NNPC Limited', 'PREFERRED', 'billing@nnpc.example', '+234 802 100 0003'],
    ['Halliburton', 'STANDARD', 'finance@halliburton.example', '+234 802 100 0004'],
  ];
  for (const [name, tier, billingEmail, phone] of COMPANIES) {
    await client.query(
      `INSERT INTO companies (id, name, tier, billing_email, phone, status, updated_at)
       VALUES ($1,$2,$3::"CompanyTier",$4,$5,'ACTIVE',now())
       ON CONFLICT (name) DO UPDATE SET tier = EXCLUDED.tier`,
      [uuid(), name, tier, billingEmail, phone],
    );
  }
    console.log('Seeded demo operational data (inventory, assets, work orders, employees, leave, payroll, finance, housekeeping, companies).');
  }
  if (!SEED_DEMO) console.log('Config seeded; demo/sample data skipped (set SEED_DEMO=true to include it).');

  // Verify
  const counts = {};
  for (const t of ['permissions', 'roles', 'users', 'room_types', 'rooms', 'menu_categories', 'menu_items',
    'inventory_items', 'assets', 'work_orders', 'employees', 'leave_requests', 'payroll_periods', 'finance_transactions', 'housekeeping_tasks']) {
    counts[t] = (await client.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
  }
  console.log('Seeded counts:', counts);
  await client.end();
  console.log('Provisioning complete.');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
