import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole, UserStatus } from './user.enums.js';

@Entity({ name: 'users' })
export class User {
  // UUIDs are not sequential, so ids can't be enumerated.
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  // Always stored lowercase (normalized by UsersService).
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 254 })
  email: string;

  // Excluded from every query unless explicitly selected (only Auth does).
  @Column({ name: 'password_hash', type: 'varchar', length: 72, select: false })
  passwordHash: string;

  @Index()
  @Column({ type: 'enum', enum: UserRole, default: UserRole.Viewer })
  role: UserRole;

  @Index()
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.Active })
  status: UserStatus;

  // Plain column instead of @CreateDateColumn so the seed can backdate rows.
  @Index()
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
