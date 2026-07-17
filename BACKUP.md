# Backups

The database is the hotel's single source of truth: every booking, every naira,
the audit trail. **While the Supabase project is on the free tier there is no
restorable cloud backup** — if the database goes, all of it goes. This script is
the copy the hotel owns.

It is also the answer for a client who requires data held **on their own
premises** rather than in the cloud: point `BACKUP_DIR` at a local disk or an
on-site server and the copy never leaves the building.

## Taking a backup

```bash
cd backend
npm run db:backup                                  # → ./backups/acemco-<timestamp>.sql
BACKUP_DIR="D:/acemco-backups" npm run db:backup   # → a mapped drive / on-site server
BACKUP_KEEP=30 npm run db:backup                   # keep only the newest 30 files
```

Output is plain SQL (enum types + `INSERT`s), deliberately — `pg_dump` isn't
installed on most Windows machines, and a `.sql` file restores into anything that
speaks Postgres, including a future self-hosted server.

The script **exits non-zero if the database is empty**, so a silent failure can't
masquerade as a successful backup.

## Restoring

Into an **empty** database (this overwrites nothing — it inserts):

```bash
psql "<connection string>" -f acemco-<timestamp>.sql
```

The file wraps everything in a transaction and defers foreign-key checks until
COMMIT, so table order doesn't matter and a partial restore can't happen: it
either all lands or none of it does.

## Scheduling it (Windows)

Task Scheduler → Create Task → Daily:

- **Program:** `C:\Program Files\nodejs\node.exe`
- **Arguments:** `prisma/backup.cjs`
- **Start in:** `<repo>\backend`
- **Environment:** set `BACKUP_DIR` to the local/on-site path, `BACKUP_KEEP=30`

Run it on a machine that is actually on at that hour.

## Rules

1. **Test the restore.** An untested backup is not a backup. Restore into a
   scratch database occasionally and confirm your bookings are there.
2. **Keep a copy off the machine that made it.** A backup on the same disk as the
   thing it protects is not a backup.
3. `.env` holds the credentials this script needs. It is gitignored — **never
   commit it, and never put a backup file in the repo**: these files contain
   guest personal data (names, phone numbers, ID details) and are covered by the
   NDPA. Store them somewhere access-controlled.
4. Moving to Supabase Pro (daily backups + optional PITR) does **not** make this
   redundant — it is the off-cloud copy.
