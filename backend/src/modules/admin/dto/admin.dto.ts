import { z } from 'zod';

/** A permission key is "module:ACTION" (e.g. "inventory:UPDATE"). */
const permissionKey = z.string().regex(/^[a-z.]+:[A-Z]+$/, 'Invalid permission key');

export const createRoleSchema = z.object({
  name: z.string().min(2).max(40),
  description: z.string().min(1).max(200),
  permissions: z.array(permissionKey).default([]),
});
export type CreateRoleDto = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(40).optional(),
  description: z.string().min(1).max(200).optional(),
  permissions: z.array(permissionKey).optional(),
});
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;

export const createUserSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  roleIds: z.array(z.string().uuid()).min(1, 'Assign at least one role'),
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  password: z.string().min(8).max(72).optional(),
});
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
