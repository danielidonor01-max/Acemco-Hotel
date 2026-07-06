import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createRoleSchema, updateRoleSchema, CreateRoleDto, UpdateRoleDto } from './dto/admin.dto';

@ApiTags('admin')
@Controller('v1/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermissions('administration:VIEW')
  @ApiOperation({ summary: 'List roles with their permissions and user counts' })
  list() {
    return this.roles.list();
  }

  @Post()
  @RequirePermissions('administration:UPDATE')
  @ApiOperation({ summary: 'Create a new management role' })
  create(@Body(new ZodValidationPipe(createRoleSchema)) dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('administration:UPDATE')
  @ApiOperation({ summary: 'Update a role (description / permissions / name)' })
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateRoleSchema)) dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('administration:UPDATE')
  @ApiOperation({ summary: 'Delete a custom (non-system) role' })
  remove(@Param('id') id: string) {
    return this.roles.remove(id);
  }
}
