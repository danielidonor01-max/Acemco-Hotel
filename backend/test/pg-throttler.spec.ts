import { PgThrottlerStorage } from '../src/common/throttler/pg-throttler.storage';

/**
 * Verifies the rate-limit algorithm (fixed window + block) against a fake in-memory
 * row store standing in for Postgres. Confirms the record it returns drives the
 * ThrottlerGuard correctly: isBlocked flips exactly when the limit is exceeded,
 * stays true for the block window, and the window resets afterwards.
 */
type Row = { key: string; hits: number; expires_at: Date; blocked_until: Date | null };

function makePrismaMock() {
  const store = new Map<string, Row>();
  const tx = {
    // SELECT ... WHERE key = ${key} FOR UPDATE
    $queryRaw: jest.fn(async (_strings: TemplateStringsArray, key: string) => {
      const row = store.get(key);
      return row ? [row] : [];
    }),
    // INSERT ... ON CONFLICT DO UPDATE  (values: key, hits, expiresAt, blockedUntil)
    $executeRaw: jest.fn(async (_s: TemplateStringsArray, key: string, hits: number, expiresAt: Date, blockedUntil: Date | null) => {
      store.set(key, { key, hits, expires_at: expiresAt, blocked_until: blockedUntil });
      return 1;
    }),
  };
  const prisma = {
    $executeRawUnsafe: jest.fn(async () => 0), // CREATE TABLE
    $executeRaw: jest.fn(async () => 0), // prune DELETE
    $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  return { prisma, store };
}

describe('PgThrottlerStorage', () => {
  const KEY = 'route-ip';
  const TTL = 1000; // ms
  const LIMIT = 3;
  const BLOCK = 1000; // ms (mirrors the app: blockDuration defaults to ttl)

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-19T00:00:00.000Z'));
    jest.spyOn(Math, 'random').mockReturnValue(0.99); // skip opportunistic prune
  });
  afterEach(() => {
    jest.useRealTimers();
    (Math.random as jest.Mock).mockRestore?.();
  });

  it('counts within the window and does not block up to the limit', async () => {
    const { prisma } = makePrismaMock();
    const s = new PgThrottlerStorage(prisma as never);

    for (let i = 1; i <= LIMIT; i++) {
      const r = await s.increment(KEY, TTL, LIMIT, BLOCK, 'default');
      expect(r.totalHits).toBe(i);
      expect(r.isBlocked).toBe(false);
    }
  });

  it('blocks once the limit is exceeded, and stays blocked within the window', async () => {
    const { prisma } = makePrismaMock();
    const s = new PgThrottlerStorage(prisma as never);

    for (let i = 0; i < LIMIT; i++) await s.increment(KEY, TTL, LIMIT, BLOCK, 'default');
    const over = await s.increment(KEY, TTL, LIMIT, BLOCK, 'default'); // 4th
    expect(over.totalHits).toBe(LIMIT + 1);
    expect(over.isBlocked).toBe(true);
    expect(over.timeToBlockExpire).toBeGreaterThan(0);

    // A further hit while blocked must not increment (stays blocked, count frozen).
    const again = await s.increment(KEY, TTL, LIMIT, BLOCK, 'default');
    expect(again.isBlocked).toBe(true);
    expect(again.totalHits).toBe(LIMIT + 1);
  });

  it('resets to a fresh window after the ttl elapses', async () => {
    const { prisma } = makePrismaMock();
    const s = new PgThrottlerStorage(prisma as never);

    for (let i = 0; i < LIMIT + 1; i++) await s.increment(KEY, TTL, LIMIT, BLOCK, 'default'); // now blocked

    jest.setSystemTime(new Date('2026-07-19T00:00:01.500Z')); // +1.5s: window + block lapsed
    const fresh = await s.increment(KEY, TTL, LIMIT, BLOCK, 'default');
    expect(fresh.isBlocked).toBe(false);
    expect(fresh.totalHits).toBe(1);
  });

  it('fails open (allows the request) if the store throws', async () => {
    const { prisma } = makePrismaMock();
    prisma.$transaction.mockRejectedValueOnce(new Error('db down'));
    const s = new PgThrottlerStorage(prisma as never);

    const r = await s.increment(KEY, TTL, LIMIT, BLOCK, 'default');
    expect(r.isBlocked).toBe(false);
    expect(r.totalHits).toBe(0);
  });
});
