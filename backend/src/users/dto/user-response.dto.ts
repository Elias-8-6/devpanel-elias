import { User } from '../user.entity.js';
import { UserRole, UserStatus } from '../user.enums.js';

// Public shape of a user. Built field by field (allowlist) so new entity
// columns never leak to the API by accident.
export class UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.name = user.name;
    dto.email = user.email;
    dto.role = user.role;
    dto.status = user.status;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
