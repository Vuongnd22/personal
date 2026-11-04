import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { FeaturesModule } from './features/features.module';
import { TasksModule } from './tasks/tasks.module';
import { ArchitectureModule } from './architecture/architecture.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Generous global limit; login is tightened with @Throttle in AuthController.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    FeaturesModule,
    TasksModule,
    ArchitectureModule,
    DashboardModule,
    ReportsModule,
    NotificationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
