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

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!started) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export const sentryEnabled = () => started;
