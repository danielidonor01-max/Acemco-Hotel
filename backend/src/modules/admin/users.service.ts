import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/admin.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(user: {
    id: string; name: string; email: string; isActive: boolean; lastLoginAt: Date | null; createdAt: Date;
    roles: { role: { id: string; name: string } }[];
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.roles.map((ur) => ({ id: ur.role.id, name: ur.role.name })),
    };
  }

  private async assertRolesExist(roleIds: string[]) {
    const found = await this.prisma.role.count({ where: { id: { in: roleIds } } });
    if (found !== roleIds.length) throw new BadRequestException({ code: 'ROLE_NOT_FOUND', message: 'One or more roles do not exist.' });
  }

  async list() {
    const users = await this.prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => this.serialize(u));
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException({ code: 'EMAIL_EXISTS', message: 'A user with that email already exists.' });
    await this.assertRolesExist(dto.roleIds);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        passwordHash,
        roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
      include: { roles: { include: { role: true } } },
    });
    return this.serialize(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    if (dto.roleIds) await this.assertRolesExist(dto.roleIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          name: dto.name ?? undefined,
          isActive: dto.isActive ?? undefined,
          ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {}),
        },
      });
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (dto.roleIds.length) {
          await tx.userRole.createMany({ data: dto.roleIds.map((roleId) => ({ userId: id, roleId })) });
        }
        // Any role change invalidates issued sessions — force re-auth to pick up new grants.
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
    });

    const fresh = await this.prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
    return this.serialize(fresh!);
  }
}
