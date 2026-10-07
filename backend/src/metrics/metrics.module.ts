import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';

@Module({
  imports: [UsersModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
