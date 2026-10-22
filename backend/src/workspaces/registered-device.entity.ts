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
  @Column({ nullable: true }) operatingSystemVersion!: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  capabilities!: Record<string, boolean>;
  @Column({ type: 'timestamptz', nullable: true }) lastSeenAt!: Date | null;
  @ManyToOne(() => Workspace, (workspace) => workspace.devices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
