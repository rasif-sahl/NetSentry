import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { RegisteredDevice } from '../workspaces/registered-device.entity';

@Entity('monitoring_retention')
export class RetentionPolicy {
  @Column('uuid', { primary: true }) workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column({ type: 'timestamptz', nullable: true }) effectiveAt: Date | null =
    null;
  @Column('integer', { default: 30 }) rawDays = 30;
  @Column('integer', { default: 365 }) aggregateDays = 365;
  @Column('integer', { default: 90 }) alertDays = 90;
  @Column('integer', { default: 7 }) diagnosticDays = 7;
}

@Entity('measurements')
@Unique(['deviceId', 'eventId'])
export class Measurement {
  @Column({ type: 'uuid', nullable: true }) networkId!: string | null;
  @ManyToOne(() => UsageNetwork, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'networkId' })
  network!: UsageNetwork | null;
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') eventId!: string;
  @Column('uuid') workspaceId!: string;
  @Index() @Column('uuid') deviceId!: string;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice;
  @Column('integer') generation!: number;
  @Column() metric!: string;
  @Column({ default: '' }) applicationId!: string;
  @Column() quality!: string;
  @Column() sourceKind!: string;
  @Column({ length: 100 }) collectorVersion!: string;
  @Column('numeric', { precision: 24, scale: 6 }) value!: string;
  @Column() unit!: string;
  @Column('timestamptz') intervalStart!: Date;
  @Column('timestamptz') intervalEnd!: Date;
  @Column('timestamptz') collectedAt!: Date;
  @CreateDateColumn({ type: 'timestamptz' }) receivedAt!: Date;
}

@Entity('measurement_receipts')
@Unique(['deviceId', 'eventId'])
export class MeasurementReceipt {
  @Column({ type: 'varchar', nullable: true }) partitionHash!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) intervalStart!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) intervalEnd!: Date | null;
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') eventId!: string;
  @Column('uuid') deviceId!: string;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice;
  @Column() payloadHash!: string;
  @CreateDateColumn({ type: 'timestamptz' }) receivedAt!: Date;
}

@Entity('measurement_batches')
@Unique(['deviceId', 'batchId'])
export class SyncBatch {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') batchId!: string;
  @Column('uuid') deviceId!: string;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice;
  @Column() payloadHash!: string;
  @CreateDateColumn({ type: 'timestamptz' }) receivedAt!: Date;
}

@Entity('collection_gaps')
@Unique(['deviceId', 'gapId'])
export class CollectionGap {
  @Column({ type: 'uuid', nullable: true }) networkId!: string | null;
  @ManyToOne(() => UsageNetwork, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'networkId' })
  network!: UsageNetwork | null;
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') gapId!: string;
  @Column('uuid') workspaceId!: string;
  @Column('uuid') deviceId!: string;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice;
  @Column('integer') generation!: number;
  @Column() metric!: string;
  @Column({ default: '' }) applicationId!: string;
  @Column() reason!: string;
  @Column() payloadHash!: string;
  @Column('timestamptz') intervalStart!: Date;
  @Column('timestamptz') intervalEnd!: Date;
  @CreateDateColumn({ type: 'timestamptz' }) receivedAt!: Date;
}

@Entity('daily_usage')
@Unique(['deviceId', 'seriesKey', 'localDate'])
export class DailyUsage {
  @Column({ type: 'uuid', nullable: true }) networkId!: string | null;
  @ManyToOne(() => UsageNetwork, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'networkId' })
  network!: UsageNetwork | null;
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @Index() @Column('uuid') deviceId!: string;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice;
  @Column() seriesKey!: string;
  @Column('date') localDate!: string;
  @Column() timezone!: string;
  @Column() metric!: string;
  @Column({ default: '' }) applicationId!: string;
  @Column() quality!: string;
  @Column() sourceKind!: string;
  @Column({ length: 100 }) collectorVersion!: string;
  @Column('numeric', { precision: 24, scale: 6 }) value!: string;
  @Column('bigint') coverageMs!: string;
  @Column('integer', { default: 0 }) proratedEvents!: number;
}

@Entity('monitoring_runs')
export class MonitoringRun {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @Column('uuid', { nullable: true }) deviceId!: string | null;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice | null;
  @Column() kind!: string;
  @Column() status!: string;
  @Column({ type: 'varchar', nullable: true }) errorCode!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
}

@Entity('usage_networks')
@Unique(['workspaceId', 'name'])
export class UsageNetwork {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column({ length: 100 }) name!: string;
  @Column({ type: 'uuid', nullable: true }) createdById!: string | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy!: User | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
@Entity('device_usage_networks')
export class DeviceUsageNetwork {
  @Column('uuid', { primary: true }) deviceId!: string;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice;
  @Column('uuid') networkId!: string;
  @ManyToOne(() => UsageNetwork, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'networkId' })
  network!: UsageNetwork;
}
