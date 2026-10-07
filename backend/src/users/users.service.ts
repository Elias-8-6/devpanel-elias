import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, MoreThanOrEqual, Repository } from 'typeorm';
import {
  PaginatedResponse,
  paginate,
} from '../common/dto/paginated-response.dto.js';
import { escapeLike } from '../common/utils/escape-like.js';
import { normalizeEmail } from '../common/utils/normalize-email.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { User } from './user.entity.js';
import { UserRole, UserStatus } from './user.enums.js';

export interface UserCountFilter {
  role?: UserRole;
  status?: UserStatus;
  createdSince?: Date;
}

// Public contract of the User service. Other services (Auth, Metrics) depend
// on this class, never on the User repository directly.
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // The only method that loads the password hash; reserved for Auth.
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', {
        email: normalizeEmail(email),
      })
      .getOne();
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  async findPaginated(
    query: ListUsersQueryDto,
  ): Promise<PaginatedResponse<UserResponseDto>> {
    const { search, page, pageSize, role, status } = query;
    const qb = this.users
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (search) {
      qb.andWhere('(user.name ILIKE :term OR user.email ILIKE :term)', {
        term: `%${escapeLike(search)}%`,
      });
    }
    if (role) qb.andWhere('user.role = :role', { role });
    if (status) qb.andWhere('user.status = :status', { status });

    const [rows, total] = await qb.getManyAndCount();
    return paginate(
      rows.map((user) => UserResponseDto.fromEntity(user)),
      total,
      page,
      pageSize,
    );
  }

  countUsers(filter: UserCountFilter = {}): Promise<number> {
    const where: FindOptionsWhere<User> = {};
    if (filter.role) where.role = filter.role;
    if (filter.status) where.status = filter.status;
    if (filter.createdSince) {
      where.createdAt = MoreThanOrEqual(filter.createdSince);
    }
    return this.users.countBy(where);
  }
}
