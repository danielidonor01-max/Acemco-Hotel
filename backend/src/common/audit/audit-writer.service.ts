import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../types/jwt-payload.types';

/** The request shape the audit trail reads. */
export interface AuditableRequest {
  method: string;
  originalUrl?: string;
  url: string;
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

export const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Never written to the log, at any depth. An audit trail must not become a credential store. */
const SECRET_KEYS = /^(password|newpassword|currentpassword|token|accesstoken|refreshtoken|secret|authorization|apikey)$/i;
const VERB_ACTION: Record<string, string> = { POST: 'CREATE', PATCH: 'UPDATE', PUT: 'UPDATE', DELETE: 'DELETE' };
const isId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) || /^\d+$/.test(s);

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
 * Writes the append-only audit trail.
 *
 * Shared by the interceptor (successes) and the exception filter (failures)
 * because they see different halves of the request: NestJS runs guards BEFORE
 * interceptors, so an RBAC rejection never reaches `next.handle()` and the
 * interceptor cannot observe it. Logging failures from the filter — which catches
 * everything, guards included — is the only way a DENIED attempt gets recorded,
 * and a denied attempt is precisely what an investigation is looking for.
 */
@Injectable()
export class AuditWriter {
  private readonly logger = new Logger(AuditWriter.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Derive module/action/actor/origin from the request. */
  describe(req: AuditableRequest) {
    const url = (req.originalUrl ?? req.url).split('?')[0];
    const segments = url.split('/').filter(Boolean);
    const vIdx = segments.findIndex((s) => /^v\d+$/.test(s));
    const rawModule = vIdx >= 0 ? segments[vIdx + 1] : segments[segments.length - 1];
    const module = (rawModule ?? 'unknown').replace(/-/g, '_');

    // A trailing named segment is the real operation: /reservations/:id/confirm →
    // CONFIRM. Logging "POST" for every one of them tells an investigator nothing.
    const tail = segments[segments.length - 1];
    const action =
      tail && tail !== rawModule && !isId(tail)
        ? tail.replace(/-/g, '_').toUpperCase()
        : (VERB_ACTION[req.method] ?? req.method);

    const fwd = req.headers?.['x-forwarded-for'];
    const ipAddress = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() || req.ip || null;
    const ua = req.headers?.['user-agent'];
    const userAgent = (Array.isArray(ua) ? ua[0] : ua)?.slice(0, 300) ?? null;

    return { url, module, action, ipAddress, userAgent, payload: redact(req.body ?? {}) as Record<string, unknown> };
  }

  /**
   * Record one attempt. Deliberately not awaited by callers: a failed audit write
   * must never fail a check-in. The cost is that an action can in principle succeed
   * unlogged — so the failure is logged loudly here rather than swallowed, which is
   * what the old `.catch(() => undefined)` prevented anyone from ever noticing.
   */
  record(
    req: AuditableRequest,
    outcome: 'SUCCESS' | 'DENIED' | 'FAILED',
    statusCode: number,
    result?: unknown,
    actorOverride?: { id?: string; email?: string },
  ): void {
    if (!MUTATING.has(req.method)) return;
    const { url, module, action, ipAddress, userAgent, payload } = this.describe(req);
    const userId = req.user?.id ?? actorOverride?.id;
    const actorEmail = req.user?.email ?? actorOverride?.email ?? null;
    const targetId = req.params?.id ?? (result as { id?: string })?.id ?? null;

    this.prisma.auditLog
      .create({
        data: {
          userId,
          actorEmail,
          action,
          module,
          targetId,
          targetType: module,
          outcome,
          statusCode,
          path: url,
          after: payload as never,
          ipAddress,
          userAgent,
        },
      })
      .catch((e) =>
        this.logger.error(`AUDIT WRITE FAILED — ${action} ${url} by ${actorEmail ?? 'anonymous'}: ${e.message}`),
      );
  }
}
