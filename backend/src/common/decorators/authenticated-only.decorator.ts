import { SetMetadata } from '@nestjs/common';

export const AUTHENTICATED_ONLY_KEY = 'authenticatedOnly';

/**
 * "Any signed-in user may call this — no specific permission required."
 *
 * Use for self-service routes (your own profile, logout) and shared landing data.
 * It exists so that having no permission decorator can mean DENY: the RBAC guard
 * used to `return true` for any route without @RequirePermissions, so a new
 * endpoint that simply forgot the decorator was silently reachable by every
 * authenticated user, whatever their role. Now the permissionless case must be
 * declared on purpose, and anything undeclared fails closed.
 */
export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY_KEY, true);
