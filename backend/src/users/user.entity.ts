import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Session } from '../auth/session.entity';
import { Membership } from '../workspaces/membership.entity';

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  PENDING_DELETION = 'PENDING_DELETION',
  SUSPENDED = 'SUSPENDED',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) email!: string;
  @Column({ length: 100 }) displayName!: string;
  @Column({ select: false }) passwordHash!: string;
  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.ACTIVE })
  status!: AccountStatus;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  preferences!: Record<string, unknown>;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
  @OneToMany(() => Session, (session) => session.user) sessions!: Session[];
  @OneToMany(() => Membership, (membership) => membership.user)
  memberships!: Membership[];
}
