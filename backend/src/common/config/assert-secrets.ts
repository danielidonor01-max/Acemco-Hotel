import { ConfigService } from '@nestjs/config';

/** Secrets the app refuses to run without. */
const REQUIRED_SECRETS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

/** Values that must never be used outside a throwaway dev box. */
const KNOWN_WEAK = [
  'insecure-dev-secret',
  'change-me',
  'dev-access-secret-please-change-min-32-chars-aa',
  'dev-refresh-secret-please-change-min-32-chars-b',
];

const MIN_LENGTH = 32;

/**
 * Fail fast on a misconfigured deploy.
 *
 * The JWT strategy used to fall back to a hardcoded `'insecure-dev-secret'` when
 * JWT_SECRET was unset, so a deploy that simply forgot the env var would keep
 * running and happily sign and ACCEPT tokens signed with a string published in
 * this repo — anyone could mint a super-admin token. A missing signing key is not
 * a condition to paper over; it's a condition to refuse to boot on.
 */
export function assertSecrets(config: ConfigService): void {
  const fatal: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED_SECRETS) {
    const value = config.get<string>(key);
    if (!value) {
      fatal.push(`${key} is not set.`);
      continue;
    }
    if (value.length < MIN_LENGTH) {
      fatal.push(`${key} is shorter than ${MIN_LENGTH} characters.`);
    }
    // A weak-but-present secret is not publicly known, so refusing to boot would
    // trade a hardening gap for an outage. Shout about it instead — loudly, every
    // start — and let the operator rotate.
    if (KNOWN_WEAK.includes(value) || /change|insecure|please/i.test(value)) {
      warnings.push(`${key} looks like a placeholder — rotate it.`);
    }
  }

  const access = config.get<string>('JWT_SECRET');
  if (access && access === config.get<string>('JWT_REFRESH_SECRET')) {
    fatal.push('JWT_SECRET and JWT_REFRESH_SECRET must differ (a leaked access key must not also mint refresh tokens).');
  }

  const generate = `Generate one with:  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`;

  if (fatal.length) {
    throw new Error(`Refusing to start — insecure auth configuration:\n${fatal.map((p) => `  - ${p}`).join('\n')}\n${generate}`);
  }
  if (warnings.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `\n⚠  INSECURE AUTH SECRETS\n${warnings.map((w) => `  - ${w}`).join('\n')}\n  ${generate}\n`,
    );
  }
}
