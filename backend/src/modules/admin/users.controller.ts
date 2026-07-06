import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createUserSchema, updateUserSchema, CreateUserDto, UpdateUserDto } from './dto/admin.dto';

@ApiTags('admin')
@Controller('v1/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('administration:VIEW')
  @ApiOperation({ summary: 'List staff accounts with their roles' })
  list() {
    return this.users.list();
  }

  @Post()
  @RequirePermissions('administration:UPDATE')
  @ApiOperation({ summary: 'Create a staff account and assign roles' })
  create(@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('administration:UPDATE')
  @ApiOperation({ summary: 'Update a staff account (status / roles / reset password)' })
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }
}
