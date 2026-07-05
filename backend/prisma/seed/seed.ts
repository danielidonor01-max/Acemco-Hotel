import { PrismaClient, PermissionAction, RoomStatus, Storefront } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// module -> actions it supports
const MODULE_ACTIONS: Record<string, PermissionAction[]> = {
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

const all = () => Object.entries(MODULE_ACTIONS).flatMap(([m, as]) => as.map((a) => `${m}:${a}`));

// Role -> permission keys ("*" = all)
const ROLE_GRANTS: Record<string, { description: string; perms: string[] | '*' }> = {
  SUPER_ADMIN: { description: 'Unrestricted access to all modules.', perms: '*' },
  HOTEL_MANAGER: {
    description: 'Full operational access, no system settings.',
    perms: all().filter((p) => p !== 'settings:UPDATE' && !p.startsWith('administration:')),
  },
  RECEPTION: {
    description: 'Reservations, check-in/out, guest management.',
    perms: ['rooms:VIEW', 'rooms:UPDATE', 'reservations:VIEW', 'reservations:CREATE', 'reservations:UPDATE', 'reception:VIEW', 'reception:CREATE', 'guests:VIEW', 'guests:CREATE', 'guests:UPDATE', 'pos.restaurant:VIEW', 'pos.lounge:VIEW'],
  },
  RESTAURANT_MANAGER: {
    description: 'Restaurant POS, menu, inventory.',
    perms: ['pos.restaurant:VIEW', 'pos.restaurant:CREATE', 'pos.restaurant:UPDATE', 'inventory:VIEW', 'reports:VIEW'],
  },
};

const ROOM_TYPES = [
  { slug: 'deluxe-king', name: 'Deluxe King', bedConfiguration: '1 King Bed', maxOccupancy: 2, basePrice: 65000, features: ['City view', 'Marble bath', 'Fast Wi-Fi', 'Smart TV'], sortOrder: 1 },
  { slug: 'twin-classic', name: 'Twin Classic', bedConfiguration: '2 Twin Beds', maxOccupancy: 2, basePrice: 58000, features: ['Garden view', 'Fast Wi-Fi', 'Work desk'], sortOrder: 2 },
  { slug: 'executive-suite', name: 'Executive Suite', bedConfiguration: '1 King Bed + Sofa', maxOccupancy: 3, basePrice: 120000, features: ['Separate lounge', 'Private bar', 'City view'], sortOrder: 3 },
  { slug: 'garden-family', name: 'Garden Family Room', bedConfiguration: '1 King + 2 Single Beds', maxOccupancy: 4, basePrice: 95000, features: ['Courtyard access', 'Family layout', 'Fast Wi-Fi'], sortOrder: 4 },
];

const STATUSES: RoomStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'AVAILABLE', 'OCCUPIED', 'INSPECTION', 'AVAILABLE', 'MAINTENANCE', 'AVAILABLE', 'OCCUPIED', 'OUT_OF_ORDER', 'AVAILABLE', 'RESERVED', 'AVAILABLE', 'CLEANING', 'OCCUPIED', 'AVAILABLE', 'AVAILABLE', 'BLOCKED', 'OCCUPIED', 'AVAILABLE', 'INSPECTION', 'AVAILABLE'];

const MENU: { storefront: Storefront; category: string; items: { name: string; description: string; price: number; tags: string[]; isAvailable?: boolean }[] }[] = [
  { storefront: 'RESTAURANT', category: 'Starters', items: [
    { name: 'Pepper Soup, Catfish', description: 'Aromatic broth, scent leaf, fresh catfish.', price: 6500, tags: ['Spicy'] },
    { name: 'Suya Beef Skewers', description: 'Charred, dusted with yaji, red onion.', price: 7000, tags: ['Spicy'] },
    { name: 'Garden Salad', description: 'Leaves, avocado, citrus dressing.', price: 5000, tags: ['Vegetarian'] },
  ]},
  { storefront: 'RESTAURANT', category: 'Mains', items: [
    { name: 'Jollof Rice & Grilled Chicken', description: 'Smoky party jollof, chicken, plantain.', price: 9500, tags: [] },
    { name: 'Seared Barramundi', description: 'Coconut sauce, greens, jasmine rice.', price: 14000, tags: [] },
    { name: 'Egusi & Pounded Yam', description: 'Melon seed stew, assorted, pounded yam.', price: 11000, tags: [], isAvailable: false },
    { name: 'Ribeye, Pepper Glaze', description: '300g grass-fed, ata rodo glaze, fries.', price: 21000, tags: ['Spicy'] },
  ]},
  { storefront: 'LOUNGE', category: 'Signatures', items: [
    { name: 'Marina Sundown', description: 'Aged rum, hibiscus, lime, bitters.', price: 8000, tags: [] },
    { name: 'Smoked Old Fashioned', description: 'Bourbon, cane sugar, oak smoke.', price: 9000, tags: [] },
    { name: 'Zobo Spritz', description: 'Hibiscus, sparkling, citrus. Zero proof.', price: 5500, tags: ['Zero-proof'] },
  ]},
  { storefront: 'LOUNGE', category: 'Small Plates', items: [
    { name: 'Peppered Snails', description: 'Bell pepper, onion, scotch bonnet.', price: 8500, tags: ['Spicy'] },
    { name: 'Plantain & Dip', description: 'Crisp plantain, smoked pepper dip.', price: 4500, tags: ['Vegetarian'] },
  ]},
];

async function main() {
  console.log('Seeding AEHOP database…');

  // Permissions
  for (const key of all()) {
    const [module, action] = key.split(':');
    await prisma.permission.upsert({
      where: { module_action: { module, action: action as PermissionAction } },
      update: {},
      create: { module, action: action as PermissionAction, description: `${action} ${module}` },
    });
  }
  const permissions = await prisma.permission.findMany();
  const permByKey = new Map(permissions.map((p) => [`${p.module}:${p.action}`, p.id]));

  // Roles + grants
  for (const [name, def] of Object.entries(ROLE_GRANTS)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description: def.description },
      create: { name, description: def.description, isSystem: true },
    });
    const keys = def.perms === '*' ? all() : def.perms;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: keys.map((k) => ({ roleId: role.id, permissionId: permByKey.get(k)! })).filter((r) => r.permissionId),
      skipDuplicates: true,
    });
  }

  // Users
  const passwordHash = await bcrypt.hash('password123', 10);
  const superRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  const mgrRole = await prisma.role.findUnique({ where: { name: 'HOTEL_MANAGER' } });

  const admin = await prisma.user.upsert({
    where: { email: 'super@acemcohotel.com' },
    update: {},
    create: { email: 'super@acemcohotel.com', passwordHash, name: 'System Administrator', isActive: true },
  });
  const manager = await prisma.user.upsert({
    where: { email: 'ada@acemcohotel.com' },
    update: {},
    create: { email: 'ada@acemcohotel.com', passwordHash, name: 'Ada Okoro', isActive: true },
  });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: superRole!.id } }, update: {}, create: { userId: admin.id, roleId: superRole!.id } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: manager.id, roleId: mgrRole!.id } }, update: {}, create: { userId: manager.id, roleId: mgrRole!.id } });

  // Room types + rooms
  const typeIdBySlug = new Map<string, string>();
  for (const rt of ROOM_TYPES) {
    const created = await prisma.roomType.upsert({
      where: { slug: rt.slug },
      update: { basePrice: rt.basePrice, features: rt.features },
      create: {
        slug: rt.slug, name: rt.name, description: `${rt.name} — a warm, considered stay.`,
        bedConfiguration: rt.bedConfiguration, maxOccupancy: rt.maxOccupancy, basePrice: rt.basePrice,
        features: rt.features, images: [], sortOrder: rt.sortOrder,
      },
    });
    typeIdBySlug.set(rt.slug, created.id);
  }
  const typeIds = [...typeIdBySlug.values()];
  for (let i = 0; i < STATUSES.length; i++) {
    const floor = Math.floor(i / 6) + 1;
    const roomNumber = String(floor * 100 + (i % 6) + 1);
    await prisma.room.upsert({
      where: { roomNumber },
      update: { status: STATUSES[i] },
      create: { roomNumber, floor, roomTypeId: typeIds[i % typeIds.length], status: STATUSES[i] },
    });
  }

  // Menus (clear + recreate for idempotency)
  await prisma.orderItem.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.menuCategory.deleteMany({});
  for (let c = 0; c < MENU.length; c++) {
    const cat = MENU[c];
    const category = await prisma.menuCategory.create({
      data: { storefront: cat.storefront, name: cat.category, sortOrder: c, isActive: true },
    });
    let s = 0;
    for (const item of cat.items) {
      await prisma.menuItem.create({
        data: {
          categoryId: category.id, storefront: cat.storefront, name: item.name, description: item.description,
          price: item.price, tags: item.tags, isAvailable: item.isAvailable ?? true, sortOrder: s++,
        },
      });
    }
  }

  console.log('Seed complete.');
  console.log('  Login: super@acemcohotel.com / password123  (SUPER_ADMIN)');
  console.log('         ada@acemcohotel.com   / password123  (HOTEL_MANAGER)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
