import { Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Postgres-backed rate-limit storage.
 *
 * The default @nestjs/throttler store is an in-process Map. On Vercel the API runs
 * as serverless functions: that Map is per-instance and wiped on every cold start,
 * so the login/booking limits were effectively per-instance and easily evaded by
 * spreading requests across instances. Backing the counters with the (already
 * present) Postgres DB makes the window GLOBAL — every instance sees the same count.
 *
 * A fixed window per key, serialised with `SELECT … FOR UPDATE` inside a transaction
 * so two concurrent requests (even on different instances) can't both slip past the
 * limit. The key already encodes the throttler name + IP + route, so one row = one
 * limiter. `blockDuration` is honoured (defaults to `ttl` in this app), so an
 * over-limit caller stays blocked for that duration.
 *
 * Fails OPEN: if the store errors, the request is allowed rather than 500'd — a
 * degraded rate limiter must never take the whole API down (and with the DB down,
 * nothing else works anyway).
 */
export class PgThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(PgThrottlerStorage.name);
  private ready?: Promise<void>;

  constructor(private readonly prisma: PrismaService) {}

  /** Create the table once per process (idempotent — safe on every cold start). */
  private ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = this.prisma
        .$executeRawUnsafe(
          `CREATE TABLE IF NOT EXISTS throttler_hits (
             key           text PRIMARY KEY,
             hits          integer NOT NULL,
             expires_at    timestamptz NOT NULL,
             blocked_until timestamptz
           )`,
        )
        .then(() => undefined)
        .catch((e) => {
          // Don't cache a failed init — let the next request retry.
          this.ready = undefined;
          throw e;
        });
    }
    return this.ready;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const now = Date.now();
    try {
      await this.ensureReady();

      const result = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ hits: number; expires_at: Date; blocked_until: Date | null }>>`
          SELECT hits, expires_at, blocked_until FROM throttler_hits WHERE key = ${key} FOR UPDATE`;
        const row = rows[0];

        let hits: number;
        let expiresAt: number;
        let blockedUntil: number | null;

        const stillBlocked = row?.blocked_until != null && +row.blocked_until > now;
        if (stillBlocked) {
          // Inside an active block window — don't count the hit, keep the state.
          hits = row!.hits;
          expiresAt = +row!.expires_at;
          blockedUntil = +row!.blocked_until!;
        } else if (!row || +row.expires_at <= now) {
          // No row, or the window has rolled over — start a fresh window.
          hits = 1;
          expiresAt = now + ttl;
          blockedUntil = 1 > limit ? now + blockDuration : null;
        } else {
          hits = row.hits + 1;
          expiresAt = +row.expires_at;
          blockedUntil = hits > limit ? now + blockDuration : null;
        }

        await tx.$executeRaw`
          INSERT INTO throttler_hits (key, hits, expires_at, blocked_until)
          VALUES (${key}, ${hits}, ${new Date(expiresAt)}, ${blockedUntil == null ? null : new Date(blockedUntil)})
          ON CONFLICT (key) DO UPDATE
            SET hits = EXCLUDED.hits, expires_at = EXCLUDED.expires_at, blocked_until = EXCLUDED.blocked_until`;

        return { hits, expiresAt, blockedUntil };
      });

      // Opportunistic housekeeping: drop rows whose window and block have both
      // lapsed, so the table doesn't accumulate one row per IP forever.
      if (Math.random() < 0.02) {
        this.prisma
          .$executeRaw`DELETE FROM throttler_hits WHERE expires_at < now() AND (blocked_until IS NULL OR blocked_until < now())`
          .catch(() => undefined);
      }

      const isBlocked = result.blockedUntil != null && result.blockedUntil > now;
      return {
        totalHits: result.hits,
        timeToExpire: Math.ceil((result.expiresAt - now) / 1000),
        isBlocked,
        timeToBlockExpire: isBlocked ? Math.ceil((result.blockedUntil! - now) / 1000) : 0,
      };
    } catch (e) {
      // Fail open — never turn a rate-limiter hiccup into a 500 for the caller.
      this.logger.error(`Throttler store unavailable, allowing request: ${(e as Error).message}`);
      return { totalHits: 0, timeToExpire: Math.ceil(ttl / 1000), isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
