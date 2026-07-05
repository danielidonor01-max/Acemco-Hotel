# Acemco Express Hotel Operations Platform (AEHOP)

A full hotel platform: a **public marketing website** (Sanity-driven content), an
**internal operations platform** (dashboard, reservations, rooms, reception, POS, and
back-office modules), and a **NestJS + Prisma API** backed by **Supabase (PostgreSQL)**.

```
Acemco/
├── docs/       Governance: Domain Model · System Blueprint · UI Constitution
├── frontend/   Next.js 16 + Tailwind v4 + shadcn/ui (public site + /manage platform)
└── backend/    NestJS 11 + Prisma 6 (REST API, JWT auth, RBAC)
```

## Architecture

| Concern | Technology |
|---|---|
| Public site + internal platform | Next.js 16 (App Router, RSC), Tailwind v4, shadcn/ui, TanStack Query |
| Operational database | **Supabase** (PostgreSQL) via Prisma |
| CMS (marketing content + imagery) | **Sanity** — `MediaFrame` slots, hero copy, offers, gallery, about, testimonials |
| API | NestJS modular monolith — JWT (access + refresh cookie), RBAC, Zod validation |

Split of responsibility (per the Domain Model — *CMS never holds operational data*):
- **Sanity** → brand/marketing content & all imagery.
- **Supabase/API** → rooms & availability, menus, reservations, orders, and the entire internal platform.

The frontend **falls back to built-in sample content** when the API / Sanity env vars are
unset, so it always renders in development.

## Run locally

### Backend
```bash
cd backend
cp .env.example .env          # set DATABASE_URL to your Supabase connection string
npm install
npx prisma migrate deploy     # or `migrate dev` for a new shadow migration
npm run prisma:seed           # roles, permissions, users, rooms, menus
npm run start:dev             # http://localhost:3001/api  ·  docs /api/docs
```

### Frontend
```bash
cd frontend
cp .env.example .env.local     # fill API + Sanity vars (or leave blank for sample data)
npm install
npm run dev                    # http://localhost:3000
```

## Deploy

### Database — Supabase
1. Create a Supabase project. Copy the **connection string** (Project → Database → Connection string, "URI").
2. Set it as `DATABASE_URL` for the backend (use the pooled connection for serverless, direct for migrations).
3. `npx prisma migrate deploy && npm run prisma:seed`.

### CMS — Sanity
1. Create a Sanity project + dataset (`production`). Model documents: `siteSettings`, `offer`,
   `testimonial`, `amenity`, `galleryImage`, `pageMedia` (see `frontend/src/lib/data/content.ts` for the fields).
2. Set `NEXT_PUBLIC_SANITY_PROJECT_ID` / `_DATASET` / `_API_VERSION` in the frontend env.

### Frontend — Vercel
- Import `frontend/` into Vercel (Next.js auto-detected).
- Env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PUBLIC_API_URL`, `NEXT_PUBLIC_SANITY_*`.

### Backend — Docker / VPS
```bash
cd backend
docker build -t aehop-api .
docker run -p 3001:3001 --env-file .env aehop-api   # runs `prisma migrate deploy` then starts
```
Put Nginx in front for TLS; point `FRONTEND_URL` at the Vercel domain for CORS.

## Documentation
- [`docs/01_Domain_Model.md`](docs/01_Domain_Model.md) — domains, entities, business invariants
- [`docs/02_System_Blueprint.md`](docs/02_System_Blueprint.md) — architecture, auth, API conventions
- [`docs/03_UI_Constitution.md`](docs/03_UI_Constitution.md) — design system (public + internal)
