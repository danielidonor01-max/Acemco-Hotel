# Deployment

Two Vercel projects, one GitHub repo (`danielidonor01-max/Acemco-Hotel`):

| Project | Root dir | Prod URL |
|---|---|---|
| `acemco-hotel-api` (NestJS) | `backend` | https://acemco-hotel-api.vercel.app |
| `acemco-hotel-web` (Next.js) | `frontend` | (web project domain) |

## Auto-deploy (enabled)

Both projects are connected to the GitHub repo (`vercel git connect`). **Every push to `main` auto-deploys both.** No more manual `vercel --prod`. CI (`.github/workflows/ci.yml`) typechecks/builds/tests both apps on push + PR.

Manual redeploy if ever needed: `cd backend && npx vercel --prod --yes` (or `frontend`).

## Same-origin API (first-party auth cookie)

The web app serves the internal API from its own origin via a Next rewrite (`frontend/next.config.ts`), so the refresh cookie is first-party (no cross-site cookies, no CORS).

- Browser calls `/api/v1/*` → rewrite → `API_PROXY_TARGET/api/v1/*`.
- Only `/api/v1/*` and `/api/public/*` are proxied — the CMS webhook route `/api/revalidate` is untouched.
- Backend refresh cookie is `SameSite=Lax` by default (`COOKIE_SAMESITE`), correct for same-origin.

### Required env vars

**`acemco-hotel-web` (frontend)** — set for Production (and Preview if used):
- `NEXT_PUBLIC_API_URL=/api/v1`  (relative — goes through the rewrite) ✅ set
- `API_PROXY_TARGET=https://acemco-hotel-api.vercel.app`  (server-only) ✅ set
- `NEXT_PUBLIC_PUBLIC_API_URL=https://acemco-hotel-api.vercel.app/api/public`  (absolute — read server-side)
- `NEXT_PUBLIC_SANITY_PROJECT_ID` / `NEXT_PUBLIC_SANITY_DATASET` / `NEXT_PUBLIC_SANITY_API_VERSION` (CMS)

**`acemco-hotel-api` (backend)**:
- `NODE_ENV=production`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `COOKIE_SAMESITE=lax` (default; only set `none` if the API is on a different site than the app)
- `FRONTEND_URL=https://<web-domain>`

> After changing any `NEXT_PUBLIC_*` or `API_PROXY_TARGET`, the **frontend must rebuild** for it to take effect (a push does this automatically).

## Database

Schema + seed are applied with Node + `pg` (the Prisma engine can't reach Supabase from the Windows dev host):

- `cd backend && npm run db:provision` — idempotent: creates tables, seeds permissions/roles/users/rooms/menus + operational modules, backfills folios for checked-in stays.
- `npm run db:reset-demo` — removes manual-QA test artifacts (test walk-ins, orphan work orders, `TEST-*` inventory).

`prisma migrate deploy` runs on Vercel build but is a no-op for tables created via `provision` (they already exist in Supabase).

## CMS (Sanity) — owner: site build

Studio is embedded at `/studio`. Remaining setup: create the `production` dataset, add CORS origins (localhost + web domain), register a webhook → `POST /api/revalidate?secret=…` (revalidates the `cms` cache tag), set a `SANITY_WRITE_TOKEN` and run `node scripts/seed-cms.js` to populate content.
