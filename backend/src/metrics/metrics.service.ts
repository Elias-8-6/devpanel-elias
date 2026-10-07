import { Injectable } from '@nestjs/common';
import { UserRole, UserStatus } from '../users/user.enums.js';
import { UsersService } from '../users/users.service.js';
import { MetricsSummaryDto } from './dto/metrics-summary.dto.js';

export function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// Composes data from the User service instead of querying the users table
// itself: user data access stays owned by a single service.
@Injectable()
export class MetricsService {
  constructor(private readonly usersService: UsersService) {}

  async getSummary(now: Date = new Date()): Promise<MetricsSummaryDto> {
    const [totalUsers, activeUsers, admins, newThisMonth] = await Promise.all([
      this.usersService.countUsers(),
      this.usersService.countUsers({ status: UserStatus.Active }),
      this.usersService.countUsers({ role: UserRole.Admin }),
      this.usersService.countUsers({ createdSince: startOfMonthUtc(now) }),
    ]);
    return {
      totalUsers,
      activeUsers,
      admins,
      newThisMonth,
      generatedAt: now.toISOString(),
    };
  }
}
