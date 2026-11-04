import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProductsModule } from '../products/products.module';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get()
  get() {
    return this.dashboard.get();
  }
}

@Module({
  imports: [AuthModule, ProductsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
