import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ArchitectureController } from './architecture.controller';
import { ArchitectureService } from './architecture.service';

@Module({
  imports: [AuthModule],
  controllers: [ArchitectureController],
  providers: [ArchitectureService],
})
export class ArchitectureModule {}
