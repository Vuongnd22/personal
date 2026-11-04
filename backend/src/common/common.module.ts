import { Global, Module } from '@nestjs/common';
import { Clock, SystemClock } from './clock/clock';
import { AppConfigService } from './config/app-config';
import { StatsService } from './stats.service';

@Global()
@Module({
  providers: [{ provide: Clock, useClass: SystemClock }, AppConfigService, StatsService],
  exports: [Clock, AppConfigService, StatsService],
})
export class CommonModule {}
