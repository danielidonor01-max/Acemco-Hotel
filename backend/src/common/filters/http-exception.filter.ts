import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiError } from '../types/api-response.types';
import { AuditWriter, AuditableRequest } from '../audit/audit-writer.service';
import { captureException } from '../observability/sentry';

/** Maps all thrown errors to the standard error envelope (Blueprint §11). */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly audit: AuditWriter) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      code = HttpStatus[status] ?? 'ERROR';
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string) ?? message;
        code = (b.code as string) ?? code;
        details = b.details;
      }
    } else if (exception instanceof Error) {
      // The stack and the real message go to the server log only. Returning
      // `exception.message` to the caller leaked internals (Prisma errors name
      // tables and columns), so callers get a generic message instead.
      this.logger.error(exception.message, exception.stack);
    }

    // Report the errors worth waking up for — unexpected 5xx, not routine 4xx
    // like a validation failure or a permission denial. Awaited BEFORE responding
    // so the event flushes off a serverless box that would otherwise freeze the
    // instant we reply. No-op (and instant) without a DSN. The path — never the
    // body — goes along, so PII/credentials don't leave with it.
    if (status >= 500) {
      await captureException(exception, { path: (req as unknown as { originalUrl?: string; url: string }).originalUrl ?? req.url, method: req.method, code });
    }

    // Record the refused/failed attempt. This is the ONLY place a guard rejection
    // can be audited: guards run before interceptors, so a 403 never reaches the
    // AuditInterceptor at all — and a denied attempt is exactly what an
    // investigation needs to see.
    this.audit.record(req as unknown as AuditableRequest, status === 403 ? 'DENIED' : 'FAILED', status);

    const payload: ApiError = {
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
      statusCode: status,
    };
    res.status(status).json(payload);
  }
}
