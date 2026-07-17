import * as Sentry from '@sentry/node';
import { Logger } from '@nestjs/common';

let started = false;

/**
 * Error tracking — inert until a DSN is provided.
 *
 * With no SENTRY_DSN set, `init` never runs and every `captureException` is a
 * silent no-op, so this adds nothing until the operator opts in by setting the
 * env var. Once set, unhandled/500 errors are reported so a 2am failure is
 * visible instead of invisible — today the only trace of a production error is a
 * console line nobody is watching.
 */
export function initSentry(dsn?: string, environment = 'production'): boolean {
  if (started) return true;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment,
    // Errors only by default — no performance sampling, to keep it free-tier light.
    tracesSampleRate: 0,
    // Never ship request bodies: they carry guest PII and, on auth routes,
    // credentials. Only the error and minimal context leave the building.
    sendDefaultPii: false,
  });
  started = true;
  new Logger('Sentry').log(`Error tracking enabled (${environment}).`);
  return true;
}

/**
 * Report an error and WAIT for it to be sent.
 *
 * On Vercel the function can freeze the instant it responds, so Sentry's
 * fire-and-forget send never completes and the event is silently dropped — which
 * is exactly why the first test errors never arrived. `flush` blocks (briefly)
 * until the event is on the wire. No-op, and instant, when tracking is disabled.
 */
export async function captureException(err: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!started) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
  try {
    await Sentry.flush(2000);
  } catch {
    /* never let telemetry delay the error response beyond the timeout */
  }
}

export const sentryEnabled = () => started;
