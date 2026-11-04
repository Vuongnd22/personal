import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Clock } from '../clock/clock';
import { today as todayFn } from '../clock/today';

@Injectable()
export class AppConfigService {
  readonly timezone: string;

  constructor(
    private config: ConfigService,
    private clock: Clock,
  ) {
    this.timezone = this.config.get<string>('APP_TIMEZONE') ?? 'Asia/Ho_Chi_Minh';
  }

  today(): string {
    return todayFn(this.clock, this.timezone);
  }

  get uploadDir(): string {
    return this.config.get<string>('UPLOAD_DIR') ?? './uploads';
  }
}
