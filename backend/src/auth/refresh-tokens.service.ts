import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { RefreshToken } from './refresh-token.entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export interface RotatedSession {
  userId: string;
  familyId: string;
}

const invalidRefresh = () =>
  new UnauthorizedException({
    code: 'INVALID_REFRESH_TOKEN',
    message: 'Sesión inválida o expirada',
  });

@Injectable()
export class RefreshTokensService {
  private readonly ttlMs: number;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
    config: ConfigService,
  ) {
    this.ttlMs =
      config.getOrThrow<number>('REFRESH_TOKEN_EXPIRES_DAYS') * DAY_MS;
  }

  get ttlMilliseconds(): number {
    return this.ttlMs;
  }

  private static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // A new familyId starts a session (login); reusing one continues it (refresh).
  async issue(
    userId: string,
    familyId: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.tokens.insert({
      userId,
      familyId,
      tokenHash: RefreshTokensService.hash(token),
      expiresAt,
    });
    return { token, expiresAt };
  }

  // Single-use: the presented token is revoked and the caller issues a new one
  // in the same family. Presenting an already revoked token means it was
  // copied (theft or replay), so the whole family is revoked.
  async rotate(rawToken: string): Promise<RotatedSession> {
    const stored = await this.tokens.findOneBy({
      tokenHash: RefreshTokensService.hash(rawToken),
    });
    if (!stored) throw invalidRefresh();

    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      throw invalidRefresh();
    }
    if (stored.expiresAt.getTime() <= Date.now()) throw invalidRefresh();

    // Conditional update makes rotation atomic: of two concurrent requests
    // with the same token, only one can win.
    const result = await this.tokens.update(
      { id: stored.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (result.affected !== 1) {
      await this.revokeFamily(stored.familyId);
      throw invalidRefresh();
    }
    return { userId: stored.userId, familyId: stored.familyId };
  }

  async revokeFamilyOf(rawToken: string): Promise<void> {
    const stored = await this.tokens.findOneBy({
      tokenHash: RefreshTokensService.hash(rawToken),
    });
    if (stored) await this.revokeFamily(stored.familyId);
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.tokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // Housekeeping so the table doesn't grow forever; run on each login.
  async purgeExpired(userId: string): Promise<void> {
    await this.tokens.delete({ userId, expiresAt: LessThan(new Date()) });
  }
}
