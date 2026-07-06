import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PermissionsController } from './permissions.controller';
import { AuditController } from './audit.controller';

/** Administration — RBAC management: roles, permissions catalogue, staff accounts, audit trail. */
@Module({
  controllers: [RolesController, UsersController, PermissionsController, AuditController],
  providers: [RolesService, UsersService],
  exports: [RolesService, UsersService],
})
export class AdminModule {}
