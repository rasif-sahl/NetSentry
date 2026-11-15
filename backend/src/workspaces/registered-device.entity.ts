import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Workspace } from './workspace.entity';

export enum DevicePlatform {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
  WINDOWS = 'WINDOWS',
  MACOS = 'MACOS',
  WEB = 'WEB',
  OTHER = 'OTHER',
}

@Entity('registered_devices')
export class RegisteredDevice {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true })
  @Column()
  installationId!: string;
  @Column('uuid') workspaceId!: string;
  @Column('uuid') registeredById!: string;
  @Column({ length: 100 }) name!: string;
  @Column({ type: 'enum', enum: DevicePlatform }) platform!: DevicePlatform;
  @Column({ type: 'varchar', nullable: true }) operatingSystemVersion!:
    string | null;
  @Column({ type: 'jsonb', default: {} })
  capabilities!: Record<string, boolean>;
  @Column({ type: 'timestamptz', nullable: true }) lastSeenAt!: Date | null;
  @ManyToOne(() => Workspace, (workspace) => workspace.devices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'registeredById' })
  registeredBy!: User;
  @Column({ type: 'varchar', default: 'UNVERIFIED' }) state!: string;
  @Column({ type: 'varchar', nullable: true, select: false }) credentialHash!:
    string | null;
  @Column({ type: 'integer', default: 1 }) generation!: number;
  @Column({ type: 'boolean', default: false }) monitoringEnabled!: boolean;
  @Column({ type: 'jsonb', default: [] }) consentScopes!: string[];
  @Column({ type: 'timestamptz', nullable: true }) enrolledAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) removedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lastSyncedAt!: Date | null;
  @Column({ type: 'varchar', nullable: true }) applicationVersion!:
    string | null;
  @Column({ type: 'varchar', nullable: true }) deviceModel!: string | null;
  @Column({ type: 'varchar', default: 'unknown' })
  batteryOptimizationStatus!: string;
  @Column({ type: 'varchar', default: 'unknown' }) permissionStatus!: string;
  @Column({ type: 'varchar', default: 'unknown' }) monitoringHealth!: string;
  @Column({ type: 'jsonb', nullable: true }) capabilityReport!: Record<
    string,
    unknown
  > | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
