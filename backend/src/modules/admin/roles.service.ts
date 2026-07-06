import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PermissionAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/admin.dto';

const SUPER_ADMIN = 'SUPER_ADMIN';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve "module:ACTION" keys to permission ids; unknown keys are rejected. */
  private async resolvePermissionIds(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const all = await this.prisma.permission.findMany();
    const byKey = new Map(all.map((p) => [`${p.module}:${p.action}`, p.id]));
    const ids: string[] = [];
    const unknown: string[] = [];
    for (const k of keys) {
      const id = byKey.get(k);
      if (id) ids.push(id);
      else unknown.push(k);
    }
    if (unknown.length) throw new BadRequestException({ code: 'UNKNOWN_PERMISSION', message: `Unknown permissions: ${unknown.join(', ')}` });
    return ids;
  }

  private serialize(role: {
    id: string; name: string; description: string; isSystem: boolean; createdAt: Date;
    permissions: { permission: { module: string; action: PermissionAction } }[];
    _count: { users: number };
  }) {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp) => `${rp.permission.module}:${rp.permission.action}`),
      userCount: role._count.users,
      createdAt: role.createdAt,
    };
  }

  async list() {
    const roles = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map((r) => this.serialize(r));
  }

  private async loadOr404(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Role not found.' });
    return role;
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException({ code: 'ROLE_EXISTS', message: 'A role with that name already exists.' });

    const permissionIds = await this.resolvePermissionIds(dto.permissions);
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        isSystem: false,
        permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
      },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
    return this.serialize(role);
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.loadOr404(id);

    // The SUPER_ADMIN role is locked — it must always retain unrestricted access.
    if (role.name === SUPER_ADMIN) {
      throw new ForbiddenException({ code: 'ROLE_LOCKED', message: 'The Super Admin role cannot be modified.' });
    }
    // System roles keep their name (code and audit trails reference it); their
    // description and permissions can still be tuned.
    if (role.isSystem && dto.name && dto.name !== role.name) {
      throw new ForbiddenException({ code: 'ROLE_NAME_LOCKED', message: 'A system role cannot be renamed.' });
    }
    if (dto.name && dto.name !== role.name) {
      const clash = await this.prisma.role.findUnique({ where: { name: dto.name } });
      if (clash) throw new ConflictException({ code: 'ROLE_EXISTS', message: 'A role with that name already exists.' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: { name: dto.name ?? undefined, description: dto.description ?? undefined },
      });
      if (dto.permissions) {
        const permissionIds = await this.resolvePermissionIds(dto.permissions);
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (permissionIds.length) {
          await tx.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })) });
        }
      }
    });
    return this.serialize(await this.loadOr404(id));
  }

  async remove(id: string) {
    const role = await this.loadOr404(id);
    if (role.isSystem) throw new ForbiddenException({ code: 'ROLE_SYSTEM', message: 'System roles cannot be deleted.' });
    if (role._count.users > 0) {
      throw new ConflictException({ code: 'ROLE_IN_USE', message: `This role is assigned to ${role._count.users} user(s). Reassign them first.` });
    }
    await this.prisma.role.delete({ where: { id } });
    return { id, deleted: true };
  }
}
