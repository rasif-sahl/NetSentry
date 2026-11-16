import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
import { UsageNetwork } from './entities';
export type Channel = 'in_app' | 'android_push' | 'ios_push';
export type RuleConfig = {
  kind: 'threshold' | 'device_offline' | 'permission_revoked';
  metric?: string;
  quality?: 'measured' | 'estimated';
  applicationId?: string;
  period: 'day' | 'week' | 'month';
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  channels: Channel[];
  quietHours?: { start: string; end: string; timezone: string };
  enabled: boolean;
};
@Entity('alert_rules')
export class AlertRule {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('uuid') userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
  @Column({ type: 'uuid', nullable: true }) deviceId!: string | null;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice | null;
  @Column({ type: 'uuid', nullable: true }) networkId!: string | null;
  @ManyToOne(() => UsageNetwork, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'networkId' })
  network!: UsageNetwork | null;
  @Column('jsonb') config!: RuleConfig;
  @Column({ default: '' }) windowKey!: string;
  @Column({ default: false }) active!: boolean;
  @Column('integer', { default: 0 }) cycle!: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
@Entity('alerts')
@Unique(['ruleId', 'cycle'])
export class AlertOccurrence {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') ruleId!: string;
  @ManyToOne(() => AlertRule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ruleId' })
  rule!: AlertRule;
  @Column('integer') cycle!: number;
  @Column('jsonb') sourceDeviceIds!: string[];
  @Column('jsonb') snapshot!: {
    kind: string;
    severity: string;
    value: string | null;
    windowKey: string;
    quality?: 'measured' | 'estimated';
  };
  @Column({ type: 'timestamptz', nullable: true }) acknowledgedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) resolvedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
export type DeliveryStatus =
  | 'pending'
  | 'retry'
  | 'delivered'
  | 'unavailable'
  | 'suppressed'
  | 'cancelled'
  | 'failed';
@Entity('notification_deliveries')
@Unique(['alertId', 'channel'])
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') alertId!: string;
  @ManyToOne(() => AlertOccurrence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alertId' })
  alert!: AlertOccurrence;
  @Column() channel!: Channel;
  @Column({ default: 'pending' }) status!: DeliveryStatus;
  @Column('integer', { default: 0 }) attempts!: number;
  @Column('timestamptz') dueAt!: Date;
  @Column('jsonb', { default: [] }) attemptHistory!: {
    at: string;
    outcome: string;
    code: string | null;
  }[];
}
@Entity('notification_preferences')
export class NotificationPreference {
  @Column('uuid', { primary: true }) userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
  @Column({ type: 'boolean', default: true }) inApp: boolean = true;
  @Column({ type: 'boolean', default: false }) push: boolean = false;
}
