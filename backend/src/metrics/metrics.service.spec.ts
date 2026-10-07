import { UserRole, UserStatus } from '../users/user.enums.js';
import { UserCountFilter, UsersService } from '../users/users.service.js';
import { MetricsService, startOfMonthUtc } from './metrics.service.js';

describe('MetricsService', () => {
  it('composes the summary from UsersService counts', async () => {
    const countUsers = vi.fn((filter: UserCountFilter = {}) => {
      if (filter.status === UserStatus.Active) return Promise.resolve(40);
      if (filter.role === UserRole.Admin) return Promise.resolve(5);
      if (filter.createdSince) return Promise.resolve(7);
      return Promise.resolve(51);
    });
    const service = new MetricsService({
      countUsers,
    } as unknown as UsersService);
    const now = new Date('2026-10-07T15:00:00Z');

    await expect(service.getSummary(now)).resolves.toEqual({
      totalUsers: 51,
      activeUsers: 40,
      admins: 5,
      newThisMonth: 7,
      generatedAt: '2026-10-07T15:00:00.000Z',
    });
    expect(countUsers).toHaveBeenCalledWith({
      createdSince: new Date('2026-10-01T00:00:00Z'),
    });
  });

  it('computes the start of the month in UTC, regardless of the server timezone', () => {
    expect(startOfMonthUtc(new Date('2026-01-31T23:59:59Z'))).toEqual(
      new Date('2026-01-01T00:00:00Z'),
    );
  });
});
