import { Controller, Get } from '@nestjs/common';
import { MetricsSummaryDto } from './dto/metrics-summary.dto.js';
import { MetricsService } from './metrics.service.js';

// Protected by the global JWT guard.
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('summary')
  summary(): Promise<MetricsSummaryDto> {
    return this.metricsService.getSummary();
  }
}
