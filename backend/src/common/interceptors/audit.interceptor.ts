import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditWriter, AuditableRequest, MUTATING } from '../audit/audit-writer.service';

/**
 * Records SUCCESSFUL mutations to the append-only audit trail.
 *
 * Failures are recorded by HttpExceptionFilter, not here. Guards run before
 * interceptors, so an RBAC rejection never reaches `next.handle()` — this class
 * literally cannot see a 403. The filter catches everything, so that's where
 * DENIED/FAILED belong.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditWriter) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuditableRequest>();
    if (!MUTATING.has(req.method)) return next.handle();

    const url = (req.originalUrl ?? req.url).split('?')[0];

    return next.handle().pipe(
      tap((result) => {
        // Login is @Public, so there's no req.user — take the actor from the
        // response, or every sign-in is filed under "System".
        const actor =
          url.endsWith('/auth/login') && (result as { user?: { id: string; email: string } })?.user
            ? (result as { user: { id: string; email: string } }).user
            : undefined;
        this.audit.record(req, 'SUCCESS', 200, result, actor);
      }),
    );
  }
}
