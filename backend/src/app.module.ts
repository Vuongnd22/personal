import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { ClockModule } from './common/clock/clock.module';
import { AppConfigModule } from './common/config/config.module';
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
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/public',
      exclude: ['/api/*'],
    }),
    PrismaModule,
    ClockModule,
    AppConfigModule,
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
})
export class AppModule {}
