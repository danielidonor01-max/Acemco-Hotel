import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../types/jwt-payload.types';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Writes an append-only AuditLog entry after every successful mutating request. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string; originalUrl?: string; url: string; params?: Record<string, string>; user?: AuthenticatedUser;
    }>();
    if (!MUTATING.has(req.method)) return next.handle();

    const url = (req.originalUrl ?? req.url).split('?')[0];
    // /api/v1/<module>/... → module segment
    const segments = url.split('/').filter(Boolean);
    const vIdx = segments.findIndex((s) => /^v\d+$/.test(s));
    const rawModule = vIdx >= 0 ? segments[vIdx + 1] : segments[segments.length - 1];
    const auditModule = (rawModule ?? 'unknown').replace(/-/g, '_');
    const userId = req.user?.id;

    return next.handle().pipe(
      tap((result) => {
        const targetId = req.params?.id ?? (result as { id?: string })?.id ?? undefined;
        // Fire-and-forget; auditing must never break the request.
        this.prisma.auditLog
          .create({ data: { userId, action: req.method, module: auditModule, targetId, targetType: auditModule } })
          .catch(() => undefined);
      }),
    );
  }
}
