// JWT payload structure (System Blueprint §5).
export interface JwtPayload {
  sub: string; // userId
  email: string;
  roles: string[];
  permissions: string[]; // "module:ACTION"
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}
