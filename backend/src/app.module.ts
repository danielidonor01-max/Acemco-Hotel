import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { GuestsModule } from './modules/guests/guests.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AdminModule } from './modules/admin/admin.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { HrModule } from './modules/hr/hr.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SettingsModule } from './modules/settings/settings.module';
import { FoliosModule } from './modules/folios/folios.module';
import { MenuModule } from './modules/menu/menu.module';
import { SearchModule } from './modules/search/search.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ChargesModule } from './modules/charges/charges.module';
import { TaxModule } from './modules/tax/tax.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ConferencesModule } from './modules/conferences/conferences.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './common/audit/audit.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuditModule,
    // Baseline request throttling. THROTTLE_TTL/THROTTLE_LIMIT were in .env but
    // nothing read them — the API, including /auth/login, had no rate limiting at
    // all, so passwords could be guessed without limit. Login is throttled far
    // harder than this baseline (see @Throttle on AuthController.login).
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),
    PrismaModule,
    AuthModule,
    RoomsModule,
    GuestsModule,
    ReservationsModule,
    OrdersModule,
    AdminModule,
    InventoryModule,
    MaintenanceModule,
    HrModule,
    PayrollModule,
    FinanceModule,
    HousekeepingModule,
    DashboardModule,
    SettingsModule,
    FoliosModule,
    MenuModule,
    SearchModule,
    CompaniesModule,
    ChargesModule,
    TaxModule,
    NotificationsModule,
    ConferencesModule,
    AvailabilityModule,
    HealthModule,
  ],
  providers: [
    // Global pipeline: throttle → JWT auth → RBAC → handler → envelope → audit → error filter.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
