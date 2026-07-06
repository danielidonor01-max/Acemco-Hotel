import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('admin')
@Controller('v1/audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('administration:VIEW')
  async list(@Query('limit') limit?: string) {
    const take = Math.min(Number(limit) || 100, 200);
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { occurredAt: 'desc' },
      take,
      include: { user: { select: { name: true, email: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      module: r.module,
      targetId: r.targetId,
      occurredAt: r.occurredAt,
      user: r.user ? r.user.name : 'System',
    }));
  }
}
