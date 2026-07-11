import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';
import { PERMISSIONS_KEY } from '../src/common/decorators/permissions.decorator';
import { AUTHENTICATED_ONLY_KEY } from '../src/common/decorators/authenticated-only.decorator';

/**
 * The guard fails CLOSED: a route that declares no access policy is denied.
 * These cover the two ways that can go wrong — leaving a route open by accident
 * (the old bug), and locking every user out of a legitimately permissionless
 * route like /auth/me (which would take the whole app down).
 */
describe('PermissionsGuard', () => {
  const ctx = (permissions: string[] = []): ExecutionContext =>
    ({
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
    }) as unknown as ExecutionContext;

  /** Reflector stub that returns metadata for one key only. */
  const reflectorFor = (meta: Record<string, unknown>) =>
    ({ getAllAndOverride: (key: string) => meta[key] }) as unknown as Reflector;

  it('allows a @Public() route with no user', () => {
    const guard = new PermissionsGuard(reflectorFor({ [IS_PUBLIC_KEY]: true }));
    expect(guard.canActivate(ctx())).toBe(true);
  });

  it('allows an @AuthenticatedOnly() route for any signed-in user', () => {
    const guard = new PermissionsGuard(reflectorFor({ [AUTHENTICATED_ONLY_KEY]: true }));
    // No permissions at all — e.g. /auth/me, /dashboard/brief. Must NOT 403.
    expect(guard.canActivate(ctx([]))).toBe(true);
  });

  it('allows a permissioned route when the user holds the grant', () => {
    const guard = new PermissionsGuard(reflectorFor({ [PERMISSIONS_KEY]: ['guests:VIEW'] }));
    expect(guard.canActivate(ctx(['guests:VIEW']))).toBe(true);
  });

  it('denies a permissioned route when the user lacks the grant', () => {
    const guard = new PermissionsGuard(reflectorFor({ [PERMISSIONS_KEY]: ['guests:VIEW'] }));
    expect(() => guard.canActivate(ctx(['rooms:VIEW']))).toThrow(ForbiddenException);
  });

  it('DENIES a route that declares no policy at all (fails closed)', () => {
    // The old guard returned true here, so any endpoint that forgot its decorator
    // was silently reachable by every authenticated user, whatever their role.
    const guard = new PermissionsGuard(reflectorFor({}));
    expect(() => guard.canActivate(ctx(['guests:VIEW']))).toThrow(ForbiddenException);
  });
});
