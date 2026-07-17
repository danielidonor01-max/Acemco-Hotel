import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { paginate, paginationSchema } from '../../common/utils/pagination';

/**
 * Read-only view of the audit trail.
 *
 * There is deliberately no create/update/delete endpoint: the log is append-only,
 * written by the interceptor, and nothing in the API can rewrite history. Reading
 * it needs administration:VIEW — the hotel head's role.
 */
@ApiTags('admin')
@Controller('v1/audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('administration:VIEW')
  @ApiOperation({ summary: 'Search the audit trail (paginated, filterable)' })
  async list(@Query() query: Record<string, string>) {
    // Was capped at 200 rows with no filter or paging, so anything older than the
    // last 200 actions was simply unreachable — no use in an investigation.
    const { page, pageSize } = paginationSchema.parse(query);
    const { user, module, action, outcome, from, to, search } = query;

    const where: Prisma.AuditLogWhereInput = {
      ...(user ? { userId: user } : {}),
      ...(module ? { module } : {}),
      ...(action ? { action } : {}),
      ...(outcome ? { outcome: outcome.toUpperCase() } : {}),
      ...(from || to
        ? {
            occurredAt: {
              ...(from ? { gte: new Date(from) } : {}),
              // `to` is a day; include all of it rather than stopping at midnight.
              ...(to ? { lt: new Date(new Date(to).getTime() + 86_400_000) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { targetId: { contains: search, mode: 'insensitive' } },
              { module: { contains: search, mode: 'insensitive' } },
              { action: { contains: search, mode: 'insensitive' } },
              { user: { is: { name: { contains: search, mode: 'insensitive' } } } },
              { user: { is: { email: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const mapped = rows.map((r) => ({
      id: r.id,
      action: r.action,
      module: r.module,
      targetId: r.targetId,
      occurredAt: r.occurredAt,
      outcome: r.outcome,
      statusCode: r.statusCode,
      path: r.path,
      payload: r.after ?? null,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      // The snapshotted email still identifies the actor if the account is gone.
      user: r.user?.name ?? r.actorEmail ?? 'System',
      userEmail: r.user?.email ?? r.actorEmail ?? null,
    }));

    return paginate(mapped, total, page, pageSize);
  }

  @Get('actors')
  @RequirePermissions('administration:VIEW')
  @ApiOperation({ summary: 'Staff who appear in the trail — for the filter dropdown' })
  async actors() {
    const rows = await this.prisma.auditLog.groupBy({ by: ['userId'], _count: { _all: true } });
    const ids = rows.map((r) => r.userId).filter((x): x is string => !!x);
    const users = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
      : [];
    return users.map((u) => ({ ...u, actions: rows.find((r) => r.userId === u.id)?._count._all ?? 0 }));
  }
}
