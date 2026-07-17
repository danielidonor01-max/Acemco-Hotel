import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../types/jwt-payload.types';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Never write these to the log, at any depth. An audit trail must not become a credential store. */
const SECRET_KEYS = /^(password|newpassword|currentpassword|token|accesstoken|refreshtoken|secret|authorization|apikey)$/i;

/** Verb → action when the route carries no explicit operation segment. */
const VERB_ACTION: Record<string, string> = { POST: 'CREATE', PATCH: 'UPDATE', PUT: 'UPDATE', DELETE: 'DELETE' };

/** Looks like a uuid/opaque id rather than a named operation. */
const isId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) || /^\d+$/.test(s);

/** Recursively drop secrets and trim bulk, so the log stays readable and safe. */
function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[deep]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 500) return value.slice(0, 500) + '…';
  return value;
}

/**
 * Append-only audit trail: who did what, from where, and whether it worked.
 *
 * The system is the hotel's book of record, so the log has to answer a dispute
 * months later. It previously stored only the HTTP verb and a module name — no
 * payload, no IP, no outcome — and it recorded *successes only*, so a denied
 * attempt (someone probing a module they shouldn't touch) left no trace at all.
 * The actor is snapshotted onto the row rather than left to a join, so the
 * history still names them even if the account is later removed.
 *
 * Writes stay off the request path: a failed audit write must not fail a
 * check-in. The tradeoff is that an action can, in principle, succeed unlogged —
 * so a failure is logged loudly here rather than swallowed, which is exactly what
 * the old `.catch(() => undefined)` prevented anyone from noticing.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      originalUrl?: string;
      url: string;
      params?: Record<string, string>;
      body?: Record<string, unknown>;
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      user?: AuthenticatedUser;
    }>();
    if (!MUTATING.has(req.method)) return next.handle();

    const url = (req.originalUrl ?? req.url).split('?')[0];
    const segments = url.split('/').filter(Boolean);
    const vIdx = segments.findIndex((s) => /^v\d+$/.test(s));
    const rawModule = vIdx >= 0 ? segments[vIdx + 1] : segments[segments.length - 1];
    const auditModule = (rawModule ?? 'unknown').replace(/-/g, '_');

    // A trailing named segment is the real operation: /reservations/:id/confirm →
    // CONFIRM. Far more use than logging "POST" for every one of them.
    const tail = segments[segments.length - 1];
    const action =
      tail && tail !== rawModule && !isId(tail)
        ? tail.replace(/-/g, '_').toUpperCase()
        : (VERB_ACTION[req.method] ?? req.method);

    const fwd = req.headers?.['x-forwarded-for'];
    const ipAddress = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() || req.ip || null;
    const ua = req.headers?.['user-agent'];
    const userAgent = (Array.isArray(ua) ? ua[0] : ua)?.slice(0, 300) ?? null;
    const payload = redact(req.body ?? {}) as Record<string, unknown>;

    const write = (outcome: string, statusCode: number, result?: unknown, actor?: { id?: string; email?: string }) => {
      const userId = req.user?.id ?? actor?.id;
      const actorEmail = req.user?.email ?? actor?.email ?? null;
      const targetId = req.params?.id ?? (result as { id?: string })?.id ?? null;
      this.prisma.auditLog
        .create({
          data: {
            userId,
            actorEmail,
            action,
            module: auditModule,
            targetId,
            targetType: auditModule,
            outcome,
            statusCode,
            path: url,
            // The request as sent, secrets stripped — enough to reconstruct what
            // was attempted, without turning the trail into a credential store.
            after: payload as never,
            ipAddress,
            userAgent,
          },
        })
        .catch((e) =>
          // Loudly, never silently: an unlogged action is a hole in the record, and
          // the only way anyone finds out is if this surfaces.
          this.logger.error(`AUDIT WRITE FAILED — ${action} ${url} by ${actorEmail ?? 'anonymous'}: ${e.message}`),
        );
    };

    return next.handle().pipe(
      tap((result) => {
        // Login is @Public, so there's no req.user — take the actor from the
        // response, or every sign-in is filed under "System".
        const actor =
          url.endsWith('/auth/login') && (result as { user?: { id: string; email: string } })?.user
            ? (result as { user: { id: string; email: string } }).user
            : undefined;
        write('SUCCESS', 200, result, actor);
      }),
      catchError((err) => {
        // Denied and failed attempts are the ones that matter in an investigation.
        const statusCode = Number(err?.status) || 500;
        write(statusCode === 403 ? 'DENIED' : 'FAILED', statusCode);
        return throwError(() => err);
      }),
    );
  }
}
