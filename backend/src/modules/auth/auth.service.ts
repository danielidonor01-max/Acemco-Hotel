import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.types';

export interface LoginResult {
  user: { id: string; email: string; name: string; roles: string[]; permissions: string[] };
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Effective permissions = role grants ∪ direct grants − direct revokes (Domain §3.1). */
  private async loadUserWithGrants(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        extraPermissions: { include: { permission: true } },
      },
    });
  }

  private computeGrants(user: NonNullable<Awaited<ReturnType<AuthService['loadUserWithGrants']>>>) {
    const roles = user.roles.map((ur) => ur.role.name);
    const perms = new Set<string>();
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) {
        perms.add(`${rp.permission.module}:${rp.permission.action}`);
      }
    }
    for (const up of user.extraPermissions) {
      const key = `${up.permission.module}:${up.permission.action}`;
      if (up.granted) perms.add(key);
      else perms.delete(key);
    }
    return { roles, permissions: [...perms] };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });

    const full = await this.loadUserWithGrants(user.id);
    const { roles, permissions } = this.computeGrants(full!);

    const payload: JwtPayload = { sub: user.id, email: user.email, roles, permissions };
    const accessToken = await this.signAccess(payload);
    const refreshToken = await this.issueRefresh(user.id);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return {
      user: { id: user.id, email: user.email, name: user.name, roles, permissions },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let sub: string;
    try {
      const decoded = await this.jwt.verifyAsync<{ sub: string }>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      sub = decoded.sub;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH', message: 'Session expired. Please log in again.' });
    }

    const active = await this.prisma.refreshToken.findMany({
      where: { userId: sub, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    let matched: (typeof active)[number] | undefined;
    for (const t of active) {
      if (await bcrypt.compare(refreshToken, t.tokenHash)) { matched = t; break; }
    }
    if (!matched) throw new UnauthorizedException({ code: 'INVALID_REFRESH', message: 'Session invalid. Please log in again.' });

    // Rotate: revoke the used token, issue a new pair.
    await this.prisma.refreshToken.update({ where: { id: matched.id }, data: { revokedAt: new Date() } });

    const full = await this.loadUserWithGrants(sub);
    if (!full || !full.isActive) throw new UnauthorizedException({ code: 'INACTIVE', message: 'Account is inactive.' });
    const { roles, permissions } = this.computeGrants(full);
    const accessToken = await this.signAccess({ sub, email: full.email, roles, permissions });
    const newRefresh = await this.issueRefresh(sub);
    return { accessToken, refreshToken: newRefresh };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    try {
      const decoded = await this.jwt.verifyAsync<{ sub: string }>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      const active = await this.prisma.refreshToken.findMany({ where: { userId: decoded.sub, revokedAt: null } });
      for (const t of active) {
        if (await bcrypt.compare(refreshToken, t.tokenHash)) {
          await this.prisma.refreshToken.update({ where: { id: t.id }, data: { revokedAt: new Date() } });
          break;
        }
      }
    } catch {
      /* already invalid — nothing to revoke */
    }
  }

  /** Update the signed-in user's own name; returns the fresh user (same shape as /me). */
  async updateProfile(userId: string, name: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { name } });
    const user = await this.loadUserWithGrants(userId);
    if (!user) throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    const { roles, permissions } = this.computeGrants(user);
    return { id: user.id, email: user.email, name: user.name, roles, permissions };
  }

  /** Change the signed-in user's own password (verifies the current one first). */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException({ code: 'INVALID_PASSWORD', message: 'Current password is incorrect.' });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { changed: true };
  }

  private signAccess(payload: JwtPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '15m',
    } as JwtSignOptions);
  }

  private async issueRefresh(userId: string): Promise<string> {
    const token = await this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      } as JwtSignOptions,
    );
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
    return token;
  }
}
