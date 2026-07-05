# AEHOP Backend — NestJS + Prisma

The API for the Acemco Express Hotel Operations Platform. Modular monolith per the
[System Blueprint](../docs/02_System_Blueprint.md): NestJS, Prisma, PostgreSQL, JWT auth,
RBAC, and the standard response envelope.

## Stack

- **NestJS 11** (Express platform) · **Prisma 6** · **PostgreSQL 16**
- **Zod** DTO validation · **JWT** (access 15 min + refresh 7 d, HTTP-only cookie) · **RBAC** permission guard
- Swagger at `/api/docs`

## Quick start

```bash
# 1. Start PostgreSQL (+ Redis) — requires Docker Desktop running
docker compose up -d

# 2. Install deps (already done if node_modules exists)
npm install

# 3. Create the schema + generate the client
npx prisma migrate dev --name init

# 4. Seed roles, permissions, users, rooms, and menus
npm run prisma:seed

# 5. Run the API
npm run start:dev        # http://localhost:3001/api  ·  docs at /api/docs
```

**Seed logins** (password `password123`):
| Email | Role |
|---|---|
| `super@acemcohotel.com` | SUPER_ADMIN (all permissions) |
| `ada@acemcohotel.com` | HOTEL_MANAGER |

## Verify (with the DB up)

```bash
# Login → access token + refresh cookie
curl -i -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@acemcohotel.com","password":"password123"}'

# Use the token
curl http://localhost:3001/api/v1/rooms -H "Authorization: Bearer <accessToken>"

# Public (no auth)
curl http://localhost:3001/api/public/rooms
curl http://localhost:3001/api/public/menus/restaurant
```

Even **without** a database the server boots (Prisma connects lazily): `/api/health`
reports `database: "down"`, protected routes return `401`, and Swagger works — proving
the HTTP layer, guards, validation, and envelope independently of the DB.

## What's implemented

| Area | Endpoints |
|---|---|
| **Auth** | `POST /v1/auth/login` · `POST /v1/auth/refresh` · `POST /v1/auth/logout` · `GET /v1/auth/me` |
| **Rooms** | `GET /v1/rooms` · `GET /v1/rooms/:id` · `PATCH /v1/rooms/:id/status` · `GET /v1/room-types` |
| **Guests** | `GET/POST /v1/guests` · `GET/PATCH/DELETE /v1/guests/:id` (paginated, searchable, soft-delete) |
| **Reservations** | `GET/POST /v1/reservations` · `GET /v1/reservations/:id` · `POST …/:id/confirm` · `POST …/:id/cancel` |
| **Orders** | `GET/POST /v1/orders` · `POST …/:id/advance` · `POST …/:id/cancel` |
| **Public** | `GET /public/rooms[/:slug]` · `POST /public/reservations` · `GET /public/menus/:storefront` · `POST /public/orders` |
| **Health** | `GET /health` |

Business invariants enforced in the service layer: availability at booking/confirmation,
no reservations for blacklisted guests, check-out after check-in, no cancelling a checked-in
reservation, unavailable menu items not orderable, order prices captured at order time,
website orders saved before the WhatsApp handoff.

## Architecture notes / deviations from the Blueprint

- **Express** platform adapter (Blueprint suggested Fastify) — chosen for robust cookie/passport/swagger
  support; swappable later.
- **Prisma access lives in services** for now; extracting per-module repositories (Blueprint §15) is the
  next refinement.
- Domains implemented: Auth, Rooms, Guests, Reservations, Orders (Restaurant/Lounge), plus Reception,
  Inventory, Housekeeping, Maintenance, HR, Payroll, Finance, CMS, Reports models exist in the schema and
  are ready to grow into modules following the same pattern.

## Point the frontend at this API

In `../frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_PUBLIC_API_URL=http://localhost:3001/api/public
```

Then replace the frontend's mock stores with fetch calls to these endpoints (the response
shapes already match the mock data).
