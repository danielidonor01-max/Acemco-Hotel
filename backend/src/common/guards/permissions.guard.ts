import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AUTHENTICATED_ONLY_KEY } from '../decorators/authenticated-only.decorator';
import { AuthenticatedUser } from '../types/jwt-payload.types';

/**
 * Global RBAC guard — enforces @RequirePermissions() against the user's grants.
 *
 * Fails CLOSED. Every route must declare its access exactly one way: @Public(),
 * @RequirePermissions(...), or @AuthenticatedOnly(). An undeclared route is
 * rejected. It used to `return true` when no permission decorator was present, so
 * forgetting one silently exposed the endpoint to every authenticated user
 * regardless of role — the kind of hole you only find after it's exploited.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      const authenticatedOnly = this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_ONLY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (authenticatedOnly) return true;
      // Undeclared route → deny. This is a coding error, not a user error.
      throw new ForbiddenException({
        code: 'ROUTE_NOT_DECLARED',
        message: 'This endpoint does not declare its access policy.',
      });
    }

    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const granted = new Set(user?.permissions ?? []);
    const ok = required.every((p) => granted.has(p));
    if (!ok) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You do not have permission to perform this action.',
      });
    }
    return true;
  }
}
