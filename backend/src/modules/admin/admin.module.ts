import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PermissionsController } from './permissions.controller';

/** Administration — RBAC management: roles, permissions catalogue, and staff accounts. */
@Module({
  controllers: [RolesController, UsersController, PermissionsController],
  providers: [RolesService, UsersService],
  exports: [RolesService, UsersService],
})
export class AdminModule {}
