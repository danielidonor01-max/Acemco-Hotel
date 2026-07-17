/**
 * The hotel's day is not the server's day.
 *
 * Vercel runs in UTC; the hotel closes on Lagos time (UTC+1). At 00:30 in Lagos
 * it is still *yesterday* in UTC, so a close that used the server's date would
 * freeze the wrong day's takings — and it would do it quietly. These pin the
 * boundary behaviour the night audit depends on.
 */
const localDate = (tz: string, at: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
const localHour = (tz: string, at: Date) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(at));

const LAGOS = 'Africa/Lagos';
const MS_PER_DAY = 86_400_000;

describe('night audit — hotel-local day boundaries', () => {
  it('is already tomorrow in Lagos while UTC is still yesterday', () => {
    // 23:30 UTC on the 17th is 00:30 on the 18th in Lagos.
    const at = new Date('2026-07-17T23:30:00Z');
    expect(localDate('UTC', at)).toBe('2026-07-17');
    expect(localDate(LAGOS, at)).toBe('2026-07-18');
  });

  it('reads the local hour, not the UTC hour', () => {
    // 02:00 UTC = 03:00 Lagos — the default close hour.
    expect(localHour(LAGOS, new Date('2026-07-18T02:00:00Z'))).toBe(3);
    expect(localHour('UTC', new Date('2026-07-18T02:00:00Z'))).toBe(2);
  });

  it('closes YESTERDAY when it runs at 3am — you audit the day that ended', () => {
    const now = new Date('2026-07-18T02:05:00Z'); // 03:05 in Lagos on the 18th
    expect(localDate(LAGOS, now)).toBe('2026-07-18');
    const business = localDate(LAGOS, new Date(+now - MS_PER_DAY));
    expect(business).toBe('2026-07-17');
  });

  it('handles the month boundary', () => {
    const now = new Date('2026-08-01T02:05:00Z'); // 03:05 Lagos, 1 Aug
    expect(localDate(LAGOS, new Date(+now - MS_PER_DAY))).toBe('2026-07-31');
  });

  it('handles the year boundary', () => {
    const now = new Date('2027-01-01T02:05:00Z');
    expect(localDate(LAGOS, new Date(+now - MS_PER_DAY))).toBe('2026-12-31');
  });

  it('supports a zone that observes DST, if the hotel ever moves', () => {
    // Lagos has no DST, but the setting takes any IANA zone — so this must not
    // assume a fixed offset.
    const summer = new Date('2026-07-18T02:00:00Z');
    const winter = new Date('2026-01-18T02:00:00Z');
    expect(localHour('Europe/London', summer)).toBe(3); // BST = UTC+1
    expect(localHour('Europe/London', winter)).toBe(2); // GMT = UTC+0
  });

  it('a YYYY-MM-DD business date maps to UTC midnight, matching a @db.Date column', () => {
    const d = new Date('2026-07-17T00:00:00.000Z');
    expect(d.toISOString().slice(0, 10)).toBe('2026-07-17');
    expect(d.getUTCHours()).toBe(0);
  });
});
