# AEHOP System Blueprint
**Acemco Express Hotel Operations Platform**
Version 1.0 — July 2026

---

> [!IMPORTANT]
> This is the technical playbook for the entire platform. Every architectural decision, naming convention, and integration point is documented here. No architectural pattern may be introduced without updating this document first.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Backend Folder Structure](#2-backend-folder-structure)
3. [Frontend Folder Structure](#3-frontend-folder-structure)
4. [Routing Conventions](#4-routing-conventions)
5. [Authentication & Authorization Flow](#5-authentication--authorization-flow)
6. [Permission Matrix](#6-permission-matrix)
7. [Database Strategy](#7-database-strategy)
8. [Caching Strategy](#8-caching-strategy)
9. [Realtime Strategy](#9-realtime-strategy)
10. [File Storage Strategy](#10-file-storage-strategy)
11. [API Design Conventions](#11-api-design-conventions)
12. [Frontend Data Fetching](#12-frontend-data-fetching)
13. [Environment Configuration](#13-environment-configuration)
14. [Deployment Architecture](#14-deployment-architecture)
15. [Coding Conventions](#15-coding-conventions)
16. [Testing Strategy](#16-testing-strategy)
17. [Integration Points](#17-integration-points)

---

## 1. Architecture Overview

### Pattern: DDD Modular Monolith

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACEMCO DIGITAL PLATFORM                       │
│                                                                  │
│  ┌─────────────────────┐      ┌─────────────────────────────┐   │
│  │   Public Website    │      │  Hotel Operations Platform  │   │
│  │   (Next.js — SSR)   │      │   (Next.js — Internal App)  │   │
│  └──────────┬──────────┘      └──────────────┬──────────────┘   │
│             │                                │                   │
│             │ HTTPS REST / WebSocket         │                   │
│             │                                │                   │
│  ┌──────────▼────────────────────────────────▼──────────────┐   │
│  │                  NestJS Backend (API)                     │   │
│  │                                                          │   │
│  │   ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │   │
│  │   │  Auth   │  │  Rooms   │  │ Reserv.  │  │  POS   │  │   │
│  │   └─────────┘  └──────────┘  └──────────┘  └────────┘  │   │
│  │   ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │   │
│  │   │   HR    │  │ Finance  │  │Inventory │  │  CMS   │  │   │
│  │   └─────────┘  └──────────┘  └──────────┘  └────────┘  │   │
│  │                    ... all modules                        │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│          ┌──────────────────┼──────────────────┐                │
│          │                  │                  │                │
│   ┌──────▼──────┐  ┌────────▼──────┐  ┌───────▼──────┐        │
│   │ PostgreSQL  │  │    Redis       │  │  S3 Storage  │        │
│   │  (Primary)  │  │  (Cache/PubSub)│  │   (Files)    │        │
│   └─────────────┘  └───────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Why Modular Monolith?

| Concern | Justification |
|---|---|
| **Single hotel** | No cross-tenant isolation required |
| **Small team** | Microservices overhead is unjustified |
| **Shared database** | All modules share one PostgreSQL instance |
| **Simpler deployment** | One Docker container, one Nginx config |
| **Future migration** | Module boundaries are designed to allow extraction if needed |

### Module Isolation Rules
- No module imports another module's repository directly.
- Cross-module communication goes through **module interfaces** (exported services).
- Shared utilities live in `common/`.
- Domain events flow through a shared internal **EventEmitter** (NestJS EventEmitter module) — not direct function calls.

---

## 2. Backend Folder Structure

```
backend/
├── src/
│   ├── main.ts                    # Bootstrap — Fastify adapter, Swagger, global pipes
│   ├── app.module.ts              # Root module — imports all domain modules
│   │
│   ├── modules/                   # Domain modules (one per domain)
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── jwt-refresh.strategy.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   ├── decorators/
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   └── permissions.decorator.ts
│   │   │   └── dto/
│   │   │       ├── login.dto.ts
│   │   │       └── refresh-token.dto.ts
│   │   │
│   │   ├── rooms/
│   │   │   ├── rooms.module.ts
│   │   │   ├── rooms.controller.ts
│   │   │   ├── rooms.service.ts
│   │   │   ├── room-types.controller.ts
│   │   │   ├── room-types.service.ts
│   │   │   ├── room-pricing.service.ts
│   │   │   ├── rooms.repository.ts
│   │   │   └── dto/
│   │   │       ├── create-room.dto.ts
│   │   │       ├── update-room.dto.ts
│   │   │       └── room-availability-query.dto.ts
│   │   │
│   │   ├── guests/
│   │   ├── reservations/
│   │   ├── reception/
│   │   │   ├── reception.module.ts
│   │   │   ├── checkin/
│   │   │   ├── checkout/
│   │   │   ├── walkin/
│   │   │   └── folio/
│   │   │
│   │   ├── restaurant/            # storefront = RESTAURANT
│   │   ├── lounge/                # storefront = LOUNGE
│   │   ├── boutique/              # storefront = BOUTIQUE
│   │   │
│   │   ├── inventory/
│   │   ├── housekeeping/
│   │   ├── maintenance/
│   │   │   ├── assets/
│   │   │   └── work-orders/
│   │   │
│   │   ├── hr/
│   │   │   ├── employees/
│   │   │   ├── departments/
│   │   │   ├── positions/
│   │   │   ├── leave/
│   │   │   └── attendance/
│   │   │
│   │   ├── payroll/
│   │   ├── finance/
│   │   ├── reports/
│   │   ├── cms/
│   │   ├── settings/
│   │   ├── notifications/
│   │   └── audit/
│   │
│   ├── common/                    # Shared cross-cutting concerns
│   │   ├── decorators/
│   │   │   └── audit-log.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/
│   │   │   └── permissions.guard.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   └── transform.interceptor.ts
│   │   ├── pipes/
│   │   │   └── zod-validation.pipe.ts
│   │   ├── types/
│   │   │   ├── pagination.types.ts
│   │   │   ├── api-response.types.ts
│   │   │   └── jwt-payload.types.ts
│   │   └── utils/
│   │       ├── number-generator.ts  # ReservationNumber, WONumber, etc.
│   │       ├── date.utils.ts
│   │       └── pagination.utils.ts
│   │
│   └── config/
│       ├── app.config.ts
│       ├── database.config.ts
│       ├── redis.config.ts
│       ├── jwt.config.ts
│       └── storage.config.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/
│       ├── seed.ts
│       ├── roles.seed.ts
│       ├── permissions.seed.ts
│       └── accounts.seed.ts       # Chart of Accounts
│
├── test/
│   ├── unit/
│   └── integration/
│
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

### Module Internal Structure (Pattern)

Every module follows this consistent internal structure:

```
modules/<domain>/
├── <domain>.module.ts         # Module definition, imports, exports
├── <domain>.controller.ts     # HTTP route handlers (thin layer)
├── <domain>.service.ts        # Business logic (domain rules live here)
├── <domain>.repository.ts     # Prisma queries (data access layer)
├── <domain>.events.ts         # Domain event definitions
├── <domain>.listeners.ts      # Event listeners from other domains
└── dto/
    ├── create-<entity>.dto.ts
    ├── update-<entity>.dto.ts
    └── query-<entity>.dto.ts
```

---

## 3. Frontend Folder Structure

```
frontend/
├── src/
│   ├── app/                       # Next.js App Router
│   │   │
│   │   ├── (public)/              # Public website route group
│   │   │   ├── layout.tsx         # Public layout (navbar, footer)
│   │   │   ├── page.tsx           # Home
│   │   │   ├── about/
│   │   │   │   └── page.tsx
│   │   │   ├── rooms/
│   │   │   │   ├── page.tsx       # Rooms listing
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx   # Room detail
│   │   │   ├── reservations/
│   │   │   │   └── page.tsx
│   │   │   ├── dining/
│   │   │   │   ├── page.tsx       # Dining hub
│   │   │   │   ├── restaurant/
│   │   │   │   │   └── page.tsx   # Restaurant menu
│   │   │   │   └── lounge/
│   │   │   │       └── page.tsx   # Lounge menu
│   │   │   ├── facilities/
│   │   │   │   └── page.tsx
│   │   │   ├── gallery/
│   │   │   │   └── page.tsx
│   │   │   ├── offers/
│   │   │   │   └── page.tsx
│   │   │   └── contact/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (internal)/            # Internal platform route group
│   │   │   ├── layout.tsx         # Internal layout (sidebar, header)
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx       # Permission-driven widget dashboard
│   │   │   ├── reservations/
│   │   │   ├── guests/
│   │   │   ├── rooms/
│   │   │   ├── reception/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── check-in/
│   │   │   │   ├── check-out/
│   │   │   │   └── walk-in/
│   │   │   ├── pos/
│   │   │   │   ├── restaurant/
│   │   │   │   ├── lounge/
│   │   │   │   └── boutique/
│   │   │   ├── inventory/
│   │   │   ├── housekeeping/
│   │   │   ├── maintenance/
│   │   │   │   ├── assets/
│   │   │   │   └── work-orders/
│   │   │   ├── finance/
│   │   │   ├── hr/
│   │   │   │   ├── employees/
│   │   │   │   ├── leave/
│   │   │   │   └── attendance/
│   │   │   ├── payroll/
│   │   │   ├── reports/
│   │   │   ├── settings/
│   │   │   ├── cms/
│   │   │   └── administration/
│   │   │
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── logout/
│   │   │       └── route.ts
│   │   │
│   │   ├── api/                   # Next.js Route Handlers (public website proxy only)
│   │   │   └── contact/
│   │   │       └── route.ts
│   │   │
│   │   ├── layout.tsx             # Root layout (fonts, providers)
│   │   ├── not-found.tsx
│   │   └── error.tsx
│   │
│   ├── features/                  # Domain-specific feature modules
│   │   ├── reservations/
│   │   │   ├── components/        # Domain-specific UI components
│   │   │   │   ├── ReservationForm.tsx
│   │   │   │   ├── ReservationTable.tsx
│   │   │   │   └── ReservationStatusBadge.tsx
│   │   │   ├── hooks/             # Domain-specific hooks
│   │   │   │   ├── useReservations.ts
│   │   │   │   └── useReservationMutation.ts
│   │   │   ├── api/               # API call functions
│   │   │   │   └── reservations.api.ts
│   │   │   └── schemas/           # Zod validation schemas
│   │   │       └── reservation.schema.ts
│   │   ├── rooms/
│   │   ├── guests/
│   │   ├── pos/
│   │   ├── inventory/
│   │   ├── hr/
│   │   ├── finance/
│   │   └── dashboard/
│   │       ├── widgets/           # Individual dashboard widgets
│   │       │   ├── OccupancyWidget.tsx
│   │       │   ├── RevenueWidget.tsx
│   │       │   ├── ReservationQueueWidget.tsx
│   │       │   └── LowStockWidget.tsx
│   │       └── hooks/
│   │           └── useDashboardWidgets.ts  # Loads widgets by permission
│   │
│   ├── components/                # Shared, reusable UI components
│   │   ├── ui/                    # shadcn/ui base components (auto-generated)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopHeader.tsx
│   │   │   ├── PublicNavbar.tsx
│   │   │   └── PublicFooter.tsx
│   │   ├── data/
│   │   │   ├── DataTable.tsx      # Reusable table with sorting, filtering, pagination
│   │   │   ├── DataTableColumns.tsx
│   │   │   └── EmptyState.tsx
│   │   ├── feedback/
│   │   │   ├── PageLoader.tsx
│   │   │   ├── SkeletonCard.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   └── common/
│   │       ├── StatusBadge.tsx
│   │       ├── ConfirmDialog.tsx
│   │       ├── FileUpload.tsx
│   │       └── DateRangePicker.tsx
│   │
│   ├── lib/
│   │   ├── api-client.ts          # Axios instance with interceptors
│   │   ├── auth.ts                # Auth helpers, token refresh logic
│   │   ├── permissions.ts         # Permission-checking helpers
│   │   └── utils.ts               # cn(), formatCurrency(), formatDate()
│   │
│   ├── hooks/
│   │   ├── useAuth.ts             # Current user + permissions
│   │   ├── usePermission.ts       # hasPermission(module, action)
│   │   └── useToast.ts
│   │
│   ├── providers/
│   │   ├── QueryProvider.tsx      # TanStack Query provider
│   │   ├── AuthProvider.tsx       # Auth context
│   │   └── ThemeProvider.tsx      # Dark/light mode
│   │
│   ├── stores/
│   │   └── cart.store.ts          # Zustand store for POS cart / public ordering
│   │
│   └── types/
│       ├── api.types.ts           # Shared API response types
│       ├── auth.types.ts
│       └── domain.types.ts        # Shared entity types (mirrored from backend DTOs)
│
├── public/
│   ├── fonts/
│   ├── images/
│   ├── sitemap.xml
│   └── robots.txt
│
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Routing Conventions

### Backend REST Conventions

| Pattern | Example |
|---|---|
| Resource collection | `GET /reservations` |
| Single resource | `GET /reservations/:id` |
| Create | `POST /reservations` |
| Full update | `PUT /reservations/:id` |
| Partial update | `PATCH /reservations/:id` |
| Delete | `DELETE /reservations/:id` |
| Nested resource | `GET /reservations/:id/guests` |
| Action on resource | `POST /reservations/:id/confirm` |
| Action on resource | `POST /reservations/:id/cancel` |
| Availability query | `GET /rooms/availability?checkIn=&checkOut=&roomTypeId=` |
| Public routes | `/public/rooms`, `/public/menus/restaurant` |

**Route Prefixes**
- Internal platform API: `/api/v1/` (authenticated)
- Public website API: `/api/public/` (rate-limited, no auth)

### Frontend Next.js Routing (App Router)

| Route | Description |
|---|---|
| `/` | Public home page |
| `/rooms` | Rooms listing (SSR) |
| `/rooms/[slug]` | Room detail (SSR) |
| `/dining/restaurant` | Restaurant menu (SSR) |
| `/dining/lounge` | Lounge menu (SSR) |
| `/reservations` | Reservation flow (Client) |
| `/auth/login` | Login (Public) |
| `/dashboard` | Permission-driven dashboard (Internal) |
| `/reservations` (internal) | Reservations management |
| `/pos/restaurant` | Restaurant POS |
| `/pos/lounge` | Lounge POS |
| `/pos/boutique` | Boutique POS |
| `/maintenance/assets` | Asset management |
| `/maintenance/work-orders` | Work orders |

**Route Protection**
- All `(internal)` routes require authentication.
- Each internal page checks the required permission before rendering.
- Unauthorized access redirects to `/auth/login` (unauthenticated) or `/dashboard` with an alert (authenticated but insufficient permissions).

---

## 5. Authentication & Authorization Flow

### Token Architecture

```
┌────────────────────────────────────────────────────────┐
│                     LOGIN FLOW                          │
│                                                         │
│  Client ──POST /auth/login──► Backend                  │
│                                                         │
│  Backend validates credentials                          │
│  ↓                                                      │
│  Issues:                                               │
│    accessToken  (15 min)  → returned in response body  │
│    refreshToken (7 days)  → HTTP-only cookie           │
│                                                         │
│  Frontend stores accessToken in memory (never localStorage) │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                  AUTHENTICATED REQUEST                  │
│                                                         │
│  Client request → Authorization: Bearer <accessToken>  │
│  ↓                                                      │
│  JWT Guard validates token                              │
│  ↓                                                      │
│  Permission Guard checks action on module               │
│  ↓                                                      │
│  Controller receives req.user                           │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                   TOKEN REFRESH FLOW                    │
│                                                         │
│  accessToken expired (401 received)                    │
│  ↓                                                      │
│  Axios interceptor triggers silently                    │
│  ↓                                                      │
│  POST /auth/refresh (sends HTTP-only cookie)           │
│  ↓                                                      │
│  Backend validates refresh token from cookie            │
│  ↓                                                      │
│  Issues new accessToken + rotates refreshToken          │
│  ↓                                                      │
│  Original request retried with new accessToken          │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                     LOGOUT FLOW                         │
│                                                         │
│  POST /auth/logout                                      │
│  ↓                                                      │
│  Backend revokes refreshToken in database               │
│  ↓                                                      │
│  HTTP-only cookie cleared (Set-Cookie: expires=past)    │
│  ↓                                                      │
│  Frontend clears accessToken from memory                │
│  ↓                                                      │
│  Audit Log: user.logout recorded                        │
└────────────────────────────────────────────────────────┘
```

### JWT Payload Structure

```typescript
interface JwtPayload {
  sub: string;          // userId
  email: string;
  roles: string[];      // e.g. ['HOTEL_MANAGER']
  permissions: string[]; // e.g. ['reservations:VIEW', 'reservations:CREATE']
  iat: number;
  exp: number;
}
```

### RBAC Guard Pipeline

```
Request
  ↓
JwtAuthGuard          — validates Bearer token, injects req.user
  ↓
PermissionsGuard      — checks @RequirePermissions() decorator on route
  ↓
Controller Handler
```

### Permission Decorator Usage

```typescript
// Controller example
@Get()
@RequirePermissions('reservations:VIEW')
findAll() { ... }

@Post(':id/cancel')
@RequirePermissions('reservations:UPDATE', 'reservations:APPROVE')
cancel(@Param('id') id: string) { ... }
```

### Frontend Permission Check

```typescript
// In any component or page
const { hasPermission } = usePermission();

// Render conditionally
{hasPermission('reservations', 'CREATE') && <CreateReservationButton />}

// Programmatic guard in page
if (!hasPermission('finance', 'EXPORT')) redirect('/dashboard');
```

---

## 6. Permission Matrix

> The full matrix grows as modules are implemented. This is the seed-level definition.

Format: `module:action` — ✅ Granted by default for role | ⬜ Not granted

| Module | Action | SUPER_ADMIN | HOTEL_MANAGER | RECEPTION | HR | FINANCE | REST_MGR | LOUNGE_MGR | BOUTIQUE_MGR | MAINTENANCE | HOUSEKEEPING | INVENTORY_OFFICER |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **auth** | VIEW | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **auth** | CREATE | ✅ | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **rooms** | VIEW | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ✅ | ⬜ |
| **rooms** | CREATE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **rooms** | UPDATE | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **rooms** | DELETE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **reservations** | VIEW | ✅ | ✅ | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **reservations** | CREATE | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **reservations** | UPDATE | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **reservations** | APPROVE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **reception** | VIEW | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **reception** | CREATE | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **guests** | VIEW | ✅ | ✅ | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **guests** | CREATE | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **guests** | UPDATE | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **pos.restaurant** | VIEW | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **pos.restaurant** | CREATE | ✅ | ✅ | ✅ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **pos.restaurant** | UPDATE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **pos.lounge** | VIEW | ✅ | ✅ | ✅ | ⬜ | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| **pos.lounge** | CREATE | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| **pos.boutique** | VIEW | ✅ | ✅ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| **pos.boutique** | CREATE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| **inventory** | VIEW | ✅ | ✅ | ⬜ | ⬜ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ✅ |
| **inventory** | CREATE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ |
| **inventory** | UPDATE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ |
| **inventory** | APPROVE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ |
| **housekeeping** | VIEW | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| **housekeeping** | CREATE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| **housekeeping** | UPDATE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| **maintenance** | VIEW | ✅ | ✅ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ |
| **maintenance** | CREATE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ |
| **maintenance** | UPDATE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ |
| **maintenance** | APPROVE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **hr** | VIEW | ✅ | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **hr** | CREATE | ✅ | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **hr** | UPDATE | ✅ | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **hr** | APPROVE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **payroll** | VIEW | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **payroll** | CREATE | ✅ | ✅ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **payroll** | APPROVE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **finance** | VIEW | ✅ | ✅ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **finance** | CREATE | ✅ | ✅ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **finance** | APPROVE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **finance** | EXPORT | ✅ | ✅ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **reports** | VIEW | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ✅ |
| **reports** | EXPORT | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ✅ |
| **cms** | VIEW | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **cms** | UPDATE | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **settings** | VIEW | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **settings** | UPDATE | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **administration** | VIEW | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **administration** | UPDATE | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

> [!NOTE]
> This matrix defines default role grants. Individual users can have permissions added or removed on top of their role grants.

---

## 7. Database Strategy

### Technology: PostgreSQL with Prisma ORM

### Prisma Schema Conventions

```prisma
// All models use:
// - UUID primary keys
// - snake_case column names (mapped from camelCase in Prisma)
// - createdAt / updatedAt on every entity
// - Soft deletes via deletedAt where applicable

model Room {
  id         String     @id @default(uuid())
  roomNumber String     @unique @map("room_number")
  floor      Int
  status     RoomStatus @default(AVAILABLE)
  isActive   Boolean    @default(true) @map("is_active")
  notes      String?    @db.Text
  roomTypeId String     @map("room_type_id")
  createdAt  DateTime   @default(now()) @map("created_at")
  updatedAt  DateTime   @updatedAt @map("updated_at")

  roomType   RoomType   @relation(fields: [roomTypeId], references: [id])

  @@map("rooms")
}
```

### Migration Workflow

```bash
# Development: create and apply migration
npx prisma migrate dev --name <migration-name>

# Production: apply pending migrations
npx prisma migrate deploy

# Generate Prisma client after schema changes
npx prisma generate
```

### Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Table names | `snake_case`, plural | `reservation_guests` |
| Column names | `snake_case` | `check_in_date` |
| Prisma model fields | `camelCase` | `checkInDate` |
| Enum values | `SCREAMING_SNAKE_CASE` | `CHECKED_IN` |
| FK columns | `<relation>_id` | `room_type_id` |
| Join tables | `<table_a>_<table_b>` | `user_roles` |
| Indexes | `idx_<table>_<column>` | `idx_reservations_guest_id` |

### Index Strategy

Always index:
- Foreign keys
- Columns used in `WHERE` clauses in frequent queries
- `status` columns on frequently-filtered tables
- `createdAt` on log/transaction tables
- `(roomId, checkInDate, checkOutDate)` on reservations for availability queries

### Soft Delete Pattern

For entities that must not be physically deleted (Guests, Employees, Rooms, Transactions):

```prisma
deletedAt DateTime? @map("deleted_at")
```

Repository layer applies `where: { deletedAt: null }` by default.

---

## 8. Caching Strategy

### Technology: Redis

### Use Cases

| Use Case | Key Pattern | TTL |
|---|---|---|
| Room availability result | `availability:<typeId>:<in>:<out>` | 30 seconds |
| Menu items (public) | `menu:public:<storefront>` | 5 minutes |
| User permissions | `permissions:<userId>` | 15 minutes |
| Dashboard widget data | `dashboard:<userId>:<widget>` | 60 seconds |
| Rate limiting | `ratelimit:<ip>:<endpoint>` | 1 minute |
| Session (refresh token) | `session:<userId>` | 7 days |

### Cache Invalidation

- Room availability cache is invalidated on: reservation confirmed, reservation cancelled, check-in, check-out.
- Menu cache is invalidated on: menu item create/update/delete/availability change.
- User permissions cache is invalidated on: role change, permission grant/revoke.

### Redis Pub/Sub

Used for broadcasting domain events to connected Socket.IO clients:

```
Channel: hotel:events
Messages: { type: 'reservation.confirmed', data: {...} }
           { type: 'room.status.changed', data: {...} }
           { type: 'order.status.changed', data: {...} }
```

---

## 9. Realtime Strategy

### Technology: Socket.IO

### Namespace Design

| Namespace | Purpose | Auth Required |
|---|---|---|
| `/` (default) | General hotel operations events | Yes |
| `/pos` | POS order status updates | Yes |
| `/housekeeping` | Task assignment and status | Yes |

### Event Naming Convention

`<domain>.<event>` — all lowercase with dots.

```
reservation.created
reservation.confirmed
reservation.cancelled
room.status.changed
checkin.completed
checkout.completed
order.status.changed
inventory.stock.low
task.assigned
task.completed
```

### Client Connection

```typescript
// Frontend connection in provider
const socket = io(process.env.NEXT_PUBLIC_WS_URL, {
  auth: { token: accessToken },
  transports: ['websocket'],
});
```

### Server-Side Emission

```typescript
// From service after a state change
this.eventEmitter.emit('reservation.confirmed', { reservationId, ... });

// Listener in gateway
@OnEvent('reservation.confirmed')
handleReservationConfirmed(payload) {
  this.server.emit('reservation.confirmed', payload);
}
```

---

## 10. File Storage Strategy

### Technology: S3-Compatible Object Storage (e.g., Cloudflare R2, AWS S3, MinIO)

### Bucket Organization

```
acemco-storage/
├── rooms/
│   ├── types/<roomTypeId>/<uuid>.webp
│   └── gallery/<uuid>.webp
├── menus/
│   ├── restaurant/<menuItemId>/<uuid>.webp
│   ├── lounge/<menuItemId>/<uuid>.webp
│   └── boutique/<productId>/<uuid>.webp
├── guests/
│   └── documents/<guestId>/<uuid>.<ext>
├── employees/
│   └── documents/<employeeId>/<uuid>.<ext>
├── cms/
│   ├── gallery/<uuid>.webp
│   └── offers/<uuid>.webp
├── inventory/
│   └── receipts/<poId>/<uuid>.<ext>
├── finance/
│   └── receipts/<expenseId>/<uuid>.<ext>
└── reports/
    └── exports/<reportExecutionId>/<uuid>.pdf
```

### Upload Flow

```
Client → POST /upload/presign (backend generates signed URL)
       ↓
Client → PUT directly to S3 using presigned URL (no backend bandwidth)
       ↓
Client → PATCH /<resource>/:id with { fileKey: 'rooms/types/...' }
       ↓
Backend stores the S3 key — never the full URL
```

### Image Processing
- All user-uploaded images are converted to `.webp` format.
- Thumbnails generated at 400×300 for listing views.
- Original retained for detail views.
- Use signed URLs with short expiry for private documents (guest/employee files).
- Public asset URLs (menu images, room photos) served via CDN without signing.

---

## 11. API Design Conventions

### Response Envelope

All API responses follow this structure:

```typescript
// Success
{
  "success": true,
  "data": { ... },          // Single item
  "message": "Room created successfully"
}

// Success — paginated list
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 142,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "ROOM_NOT_AVAILABLE",
    "message": "The selected room is not available for the requested dates.",
    "details": {}
  },
  "statusCode": 409
}
```

### HTTP Status Codes

| Status | When Used |
|---|---|
| 200 | Successful GET, PUT, PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE (no body) |
| 400 | Validation errors, bad request |
| 401 | Not authenticated |
| 403 | Authenticated but insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (e.g., room already occupied) |
| 422 | Business rule violation |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

### Pagination Query Parameters

```
GET /reservations?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc&status=CONFIRMED
```

| Param | Default | Notes |
|---|---|---|
| `page` | 1 | 1-indexed |
| `pageSize` | 20 | Max 100 |
| `sortBy` | `createdAt` | Field name |
| `sortOrder` | `desc` | `asc` / `desc` |

### Swagger Documentation

Every controller and DTO must have `@ApiTags()`, `@ApiOperation()`, and `@ApiResponse()` decorators. Swagger UI available at `/api/docs` in development.

---

## 12. Frontend Data Fetching

### Technology: TanStack Query v5

### Query Key Convention

```typescript
// Hierarchical keys for precise cache invalidation
const QUERY_KEYS = {
  reservations: {
    all: ['reservations'] as const,
    lists: () => [...QUERY_KEYS.reservations.all, 'list'] as const,
    list: (filters: ReservationFilters) =>
      [...QUERY_KEYS.reservations.lists(), filters] as const,
    detail: (id: string) =>
      [...QUERY_KEYS.reservations.all, 'detail', id] as const,
  },
  rooms: {
    all: ['rooms'] as const,
    availability: (params: AvailabilityParams) =>
      [...QUERY_KEYS.rooms.all, 'availability', params] as const,
  },
};
```

### Hook Pattern

```typescript
// useReservations.ts
export function useReservations(filters: ReservationFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.reservations.list(filters),
    queryFn: () => reservationsApi.findAll(filters),
    staleTime: 30_000,
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reservationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reservations.all });
      toast.success('Reservation created successfully');
    },
    onError: (error: ApiError) => {
      toast.error(error.message);
    },
  });
}
```

### Form Pattern (React Hook Form + Zod)

```typescript
// reservation.schema.ts
export const createReservationSchema = z.object({
  guestId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  checkInDate: z.string().date(),
  checkOutDate: z.string().date(),
  adults: z.number().int().min(1),
  children: z.number().int().min(0).default(0),
}).refine(
  (data) => new Date(data.checkOutDate) > new Date(data.checkInDate),
  { message: 'Check-out must be after check-in', path: ['checkOutDate'] }
);

// In component
const form = useForm<CreateReservationInput>({
  resolver: zodResolver(createReservationSchema),
  defaultValues: { adults: 1, children: 0 },
});
```

---

## 13. Environment Configuration

### Backend `.env` Structure

```bash
# Application
NODE_ENV=development
PORT=3001
APP_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/aehop_db"

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=<min-32-char-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<different-min-32-char-secret>
JWT_REFRESH_EXPIRES_IN=7d

# Storage
STORAGE_ENDPOINT=https://...
STORAGE_BUCKET=acemco-storage
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
STORAGE_PUBLIC_CDN=https://cdn.acemcohotel.com

# Email (optional v1)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

### Frontend `.env.local` Structure

```bash
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_PUBLIC_API_URL=http://localhost:3001/api/public
NEXT_PUBLIC_WS_URL=http://localhost:3001

# Storage CDN
NEXT_PUBLIC_CDN_URL=https://cdn.acemcohotel.com

# Analytics (future)
NEXT_PUBLIC_GA_ID=
```

---

## 14. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PRODUCTION                             │
│                                                             │
│  ┌──────────────────────────────────┐                      │
│  │   Vercel (Frontend)              │                      │
│  │   - Next.js SSR/SSG              │                      │
│  │   - Edge Functions               │                      │
│  │   - Automatic HTTPS              │                      │
│  └──────────────┬───────────────────┘                      │
│                 │ HTTPS                                     │
│  ┌──────────────▼───────────────────┐                      │
│  │   Ubuntu VPS                     │                      │
│  │                                  │                      │
│  │  ┌───────────────┐               │                      │
│  │  │  Nginx        │               │                      │
│  │  │  (Reverse Proxy + SSL)        │                      │
│  │  └───────┬───────┘               │                      │
│  │          │                       │                      │
│  │  ┌───────▼───────────────────┐   │                      │
│  │  │  Docker Compose           │   │                      │
│  │  │                           │   │                      │
│  │  │  ┌──────────────────┐    │   │                      │
│  │  │  │  NestJS App      │    │   │                      │
│  │  │  │  (Container)     │    │   │                      │
│  │  │  └──────────────────┘    │   │                      │
│  │  │                           │   │                      │
│  │  │  ┌──────────────────┐    │   │                      │
│  │  │  │  Redis           │    │   │                      │
│  │  │  │  (Container)     │    │   │                      │
│  │  │  └──────────────────┘    │   │                      │
│  │  └───────────────────────────┘   │                      │
│  │                                  │                      │
│  └──────────────────────────────────┘                      │
│                                                             │
│  ┌──────────────────────────────────┐                      │
│  │   Managed PostgreSQL             │                      │
│  │   (Render / Supabase / Railway)  │                      │
│  └──────────────────────────────────┘                      │
│                                                             │
│  ┌──────────────────────────────────┐                      │
│  │   S3-Compatible Object Storage   │                      │
│  │   (Cloudflare R2 recommended)    │                      │
│  └──────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### Docker Compose (Production)

```yaml
version: '3.9'
services:
  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    env_file: .env
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

### Nginx Configuration Sketch

```nginx
server {
    listen 443 ssl http2;
    server_name api.acemcohotel.com;

    ssl_certificate /etc/letsencrypt/live/api.acemcohotel.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.acemcohotel.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### CI/CD

- Backend: GitHub Actions → build Docker image → push to registry → SSH deploy to VPS → `docker compose up -d`.
- Frontend: Vercel auto-deploys on `main` branch push.

---

## 15. Coding Conventions

### TypeScript

- Strict mode enabled: `"strict": true` in `tsconfig.json`.
- No `any` types. Use `unknown` and narrow when necessary.
- Prefer `interface` over `type` for object shapes; use `type` for unions and intersections.
- Always explicitly type function return values on public methods.
- Use `readonly` on DTO input properties.

### Naming

| Item | Convention | Example |
|---|---|---|
| Files | kebab-case | `reservation.service.ts` |
| Classes | PascalCase | `ReservationService` |
| Interfaces | PascalCase | `CreateReservationDto` |
| Functions/methods | camelCase | `findAvailableRooms()` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_OCCUPANCY` |
| React components | PascalCase | `ReservationForm.tsx` |
| Hooks | `use` prefix, camelCase | `useReservations.ts` |
| Enums | PascalCase name, SCREAMING_SNAKE values | `enum RoomStatus { AVAILABLE }` |

### ESLint / Prettier

- Prettier: 2-space indent, single quotes, trailing commas, 100 char line width.
- ESLint extends: `@nestjs/eslint-config` (backend), `next/core-web-vitals` (frontend).
- No unused variables (`no-unused-vars: error`).
- No console.log in production code (use NestJS Logger).

### Backend Specific

- Controllers are thin: no business logic, only call services.
- Services contain all domain logic and enforce business invariants.
- Repositories handle all Prisma queries — no raw Prisma calls in services.
- Use NestJS built-in `Logger` — never `console.log`.
- Always validate DTOs with the global `ValidationPipe`.
- Every mutation endpoint must call `this.auditLogService.record(...)`.

### Frontend Specific

- No direct API calls in components — use feature hooks.
- Use `cn()` utility (clsx + tailwind-merge) for conditional classes.
- Never hardcode colors or spacing values — use design token CSS variables.
- Server Components for public pages; Client Components for interactive internal pages.
- Use `'use client'` directive only when necessary.

---

## 16. Testing Strategy

### Backend

| Test Type | Scope | Tool |
|---|---|---|
| Unit | Service methods, domain logic, business invariants | Jest |
| Integration | Controller → Service → Repository → DB | Jest + Supertest + test DB |
| E2E | Full HTTP flows for critical paths | Jest + Supertest |

**Critical Paths to Test:**
- Reservation creation and availability check
- Check-in / check-out flow
- Token refresh flow
- Inventory deduction (cannot go negative)
- Payroll period duplicate prevention
- Permission guard enforcement

### Frontend

| Test Type | Scope | Tool |
|---|---|---|
| Unit | Utility functions, schema validators | Vitest |
| Component | Form interactions, data rendering | React Testing Library |
| E2E | Critical user journeys | Playwright |

**Critical Journeys to Test:**
- Public reservation flow end-to-end
- POS order creation and completion
- Login → dashboard widget loading

### Test Database

Use a separate `aehop_test` PostgreSQL database with `prisma migrate deploy` applied before test runs. Wipe and reseed between integration test suites.

---

## 17. Integration Points

### WhatsApp (Public Ordering Flow)

```
Order saved (status: PENDING)
↓
Frontend constructs WhatsApp deep link:
  https://wa.me/2348000000000?text=<encoded-order-summary>
↓
window.open(whatsappLink)
```

Order is **always saved first**. WhatsApp message is generated client-side from the saved order data. The hotel WhatsApp number is stored in Settings.

### Future Integration Extension Points

| Integration | Extension Point |
|---|---|
| Online payments | `PaymentGatewayService` stub in Finance module |
| QR room service | Existing website ordering flow; add `source: QR_CODE` enum value |
| WhatsApp Business API | Replace link generation with API call in Notifications module |
| Loyalty program | `GuestLoyaltyService` in Guests module |
| Accounting (QuickBooks, Sage) | Export endpoint in Finance module |
| BI dashboards | ReportExecution results exposed via read-only API |

---

*System Blueprint v1.0 — Acemco Express Holiday Inn*  
*This document is the architectural authority. No new patterns may be introduced without updating it.*
