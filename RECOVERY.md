# If the database is ever lost — how to get everything back

You do **not** need to read this now. It's the "break glass in emergency" guide, for
the (hopefully never) day the live database is wiped or corrupted. Keep it; you or
whoever helps you can follow it step by step.

## What you need

1. **A recent backup file.** GitHub takes one every day automatically.
   - Go to the repo → **Actions** tab → **backup** → click the most recent green run.
   - Under **Artifacts**, download `acemco-db-backup-…` and unzip it. Inside is a file
     ending in `.sql.gpg`.
2. **The backup passphrase** (the `BACKUP_PASSPHRASE` you saved in your password
   manager). Without it the backup cannot be opened — this is why we keep it safe.
3. **The database connection string** for the database you're restoring INTO, set as
   `DIRECT_URL` in `backend/.env`.

## The steps

Open a terminal in the project's `backend` folder.

**1. Decrypt the backup** (turns the `.sql.gpg` into plain `restore.sql`):
```
gpg --batch --passphrase "YOUR_PASSPHRASE" --decrypt acemco-XXXX.sql.gpg > restore.sql
```

**2. If you're restoring into a brand-new, empty database** (a fresh Supabase project
or a new server), first create the tables:
```
npm run db:provision
```
Skip this step if you're restoring into a database that already has the tables and
just lost its data.

**3. Load the data back:**
```
npm run db:restore -- restore.sql
```
That's it. It prints which database it's writing to, restores every row, and leaves
any existing rows untouched (it never deletes anything).

## Good to know

- The backup is **plain SQL**, so it can be loaded into any PostgreSQL database —
  including a future self-hosted / on-premises server. For an on-prem copy you can
  also run `npm run db:backup` yourself and point `BACKUP_DIR` at a local drive.
- Backups older than 90 days roll off GitHub automatically. For long-term keeping,
  download one occasionally and store it somewhere permanent.
- **Rehearse once when a staging database exists** — restoring into a throwaway
  database proves the whole loop end to end, with zero risk to the live system.
