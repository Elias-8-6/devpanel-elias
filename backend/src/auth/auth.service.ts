import { randomBytes } from 'node:crypto';
import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { BCRYPT_COST } from '../common/security.constants.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { User } from '../users/user.entity.js';
import { UserStatus } from '../users/user.enums.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtPayload } from './jwt-payload.interface.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

export interface AuthSession {
  user: UserResponseDto;
  accessToken: string;
  refreshToken: string;
}

const invalidCredentials = () =>
  new UnauthorizedException({
    code: 'INVALID_CREDENTIALS',
    message: 'Credenciales inválidas',
  });

@Injectable()
export class AuthService implements OnModuleInit {
  // Compared against when the email doesn't exist, so a login attempt takes
  // the same time whether or not the account exists (no user enumeration).
  private dummyHash: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await bcrypt.hash(
      randomBytes(16).toString('hex'),
      BCRYPT_COST,
    );
  }

  async login({ email, password }: LoginDto): Promise<AuthSession> {
    const user = await this.usersService.findByEmailWithPassword(email);
    const passwordOk = await bcrypt.compare(
      password,
      user?.passwordHash ?? this.dummyHash,
    );
    // Inactive accounts get the same generic error as a wrong password.
    if (!user || !passwordOk || user.status !== UserStatus.Active) {
      throw invalidCredentials();
    }

    await this.refreshTokens.purgeExpired(user.id);
    return this.createSession(user);
  }

  async refresh(rawRefreshToken: string): Promise<AuthSession> {
    const { userId, familyId } =
      await this.refreshTokens.rotate(rawRefreshToken);

    // Re-check the account: a user deactivated mid-session can't keep
    // refreshing for 7 days.
    const user = await this.usersService.findById(userId);
    if (!user || user.status !== UserStatus.Active) {
      await this.refreshTokens.revokeFamily(familyId);
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Sesión inválida o expirada',
      });
    }
    return this.createSession(user, familyId);
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken)
      await this.refreshTokens.revokeFamilyOf(rawRefreshToken);
  }

  async me(userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(userId);
    if (!user || user.status !== UserStatus.Active) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Sesión no válida',
      });
    }
    return UserResponseDto.fromEntity(user);
  }

  private async createSession(
    user: User,
    familyId?: string,
  ): Promise<AuthSession> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const [accessToken, refresh] = await Promise.all([
      this.jwt.signAsync(payload),
      this.refreshTokens.issue(user.id, familyId),
    ]);
    return {
      user: UserResponseDto.fromEntity(user),
      accessToken,
      refreshToken: refresh.token,
    };
  }
}
