import { apiRequest } from "@/lib/api";

export interface AdminRole {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[]; // "module:ACTION" keys
  userCount: number;
  createdAt: string;
}

export interface PermissionGroup {
  module: string;
  actions: { key: string; action: string }[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { id: string; name: string }[];
}

export interface RoleInput {
  name: string;
  description: string;
  permissions: string[];
}

export interface UserInput {
  name: string;
  email: string;
  password: string;
  roleIds: string[];
}

const body = (v: unknown) => JSON.stringify(v);

export const listRoles = () => apiRequest<AdminRole[]>("/roles").then((r) => r.data);
export const createRole = (input: RoleInput) =>
  apiRequest<AdminRole>("/roles", { method: "POST", body: body(input) }).then((r) => r.data);
export const updateRole = (id: string, input: Partial<RoleInput>) =>
  apiRequest<AdminRole>(`/roles/${id}`, { method: "PATCH", body: body(input) }).then((r) => r.data);
export const deleteRole = (id: string) =>
  apiRequest<{ id: string; deleted: boolean }>(`/roles/${id}`, { method: "DELETE" }).then((r) => r.data);

export const listPermissions = () => apiRequest<PermissionGroup[]>("/permissions").then((r) => r.data);

export const listUsers = () => apiRequest<AdminUser[]>("/users").then((r) => r.data);
export const createUser = (input: UserInput) =>
  apiRequest<AdminUser>("/users", { method: "POST", body: body(input) }).then((r) => r.data);
export const updateUser = (
  id: string,
  input: Partial<{ name: string; isActive: boolean; roleIds: string[]; password: string }>,
) => apiRequest<AdminUser>(`/users/${id}`, { method: "PATCH", body: body(input) }).then((r) => r.data);
