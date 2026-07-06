import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('admin')
@Controller('v1/permissions')
export class PermissionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('administration:VIEW')
  @ApiOperation({ summary: 'Permission catalogue grouped by module (for the role matrix)' })
  async list() {
    const perms = await this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
    const groups = new Map<string, { key: string; action: string }[]>();
    for (const p of perms) {
      const arr = groups.get(p.module) ?? [];
      arr.push({ key: `${p.module}:${p.action}`, action: p.action });
      groups.set(p.module, arr);
    }
    return [...groups.entries()].map(([module, actions]) => ({ module, actions }));
  }
}
