import { randomBytes } from 'node:crypto';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../user.entity.js';
import { UserRole, UserStatus } from '../user.enums.js';
import { UsersService } from '../users.service.js';

export const BCRYPT_COST = 10;
const DEMO_USERS = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

const FIRST_NAMES = [
  'Ana',
  'Luis',
  'María',
  'Carlos',
  'Sofía',
  'Jorge',
  'Valeria',
  'Diego',
  'Camila',
  'Andrés',
  'Lucía',
  'Miguel',
  'Isabel',
  'Pedro',
  'Elena',
  'Raúl',
];
const LAST_NAMES = [
  'González',
  'Rodríguez',
  'Pérez',
  'Martínez',
  'Sánchez',
  'Ramírez',
  'Torres',
  'Flores',
  'Rivera',
  'Herrera',
  'Castillo',
  'Vargas',
  'Morales',
];

// Removes accents so generated emails are plain ASCII ("maría" -> "maria").
const slug = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Populates an empty database on boot. Idempotent (skips when users exist)
// and disabled in production.
@Injectable()
export class UsersSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersSeeder.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') === 'production') return;
    if ((await this.users.count()) > 0) return;

    const adminEmail = UsersService.normalizeEmail(
      this.config.getOrThrow<string>('SEED_ADMIN_EMAIL'),
    );
    const adminHash = await bcrypt.hash(
      this.config.getOrThrow<string>('SEED_ADMIN_PASSWORD'),
      BCRYPT_COST,
    );
    // Demo users get a random, never-disclosed password: they exist to fill
    // the table, not to log in. Hashed once to keep boot fast.
    const demoHash = await bcrypt.hash(
      randomBytes(24).toString('base64'),
      BCRYPT_COST,
    );

    const admin = this.users.create({
      name: 'Admin DevPanel',
      email: adminEmail,
      passwordHash: adminHash,
      role: UserRole.Admin,
      status: UserStatus.Active,
    });
    await this.users.save([admin, ...this.buildDemoUsers(demoHash)]);

    this.logger.log(`Seeded ${DEMO_USERS + 1} users (admin: ${adminEmail})`);
  }

  // Deterministic data (no randomness) so every run of the project shows the
  // same table and metrics.
  private buildDemoUsers(passwordHash: string): User[] {
    const roles = [
      UserRole.Viewer,
      UserRole.Viewer,
      UserRole.Editor,
      UserRole.Admin,
    ];
    const now = Date.now();

    return Array.from({ length: DEMO_USERS }, (_, i) => {
      const first = FIRST_NAMES[i % FIRST_NAMES.length];
      const last = LAST_NAMES[(i * 7) % LAST_NAMES.length];
      return this.users.create({
        name: `${first} ${last}`,
        email: `${slug(first)}.${slug(last)}${i + 1}@devpanel.local`,
        passwordHash,
        role: roles[i % roles.length],
        status: i % 5 === 0 ? UserStatus.Inactive : UserStatus.Active,
        // Spread over the last ~4 months so "new this month" is meaningful.
        createdAt: new Date(now - ((i * 37) % 120) * DAY_MS),
      });
    });
  }
}
