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
import { UsageNetwork } from '../../monitoring/entity/entities';
import { Agent } from '../../agents/entity/agent.entities';
import { User } from '../../users/entity/user.entity';
import { RegisteredDevice } from '../../workspaces/entity/registered-device.entity';
@Entity('network_profiles')
export class NetworkProfile {
  @Column('uuid', { primary: true }) networkId!: string;
  @ManyToOne(() => UsageNetwork, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'networkId' })
  network!: UsageNetwork;
  @Column('jsonb') cidrs!: string[];
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
@Entity('network_collectors')
export class NetworkCollector {
  @Column('uuid', { primary: true }) agentId!: string;
  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent!: Agent;
  @Column('uuid') networkId!: string;
  @ManyToOne(() => NetworkProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'networkId' })
  network!: NetworkProfile;
  @Column('integer') generation!: number;
  @Column('integer', { default: 1 }) revision!: number;
  @Column({ default: true }) enabled!: boolean;
  @Column('timestamptz', { nullable: true }) observedAt!: Date | null;
  @Column('uuid', { nullable: true }) snapshotId!: string | null;
  @Column('varchar', { nullable: true, select: false }) snapshotHash!:
    string | null;
  @Column('jsonb', { default: [] }) interfaces!: {
    name: string;
    cidr: string;
    gateway: string | null;
  }[];
  @Column({ default: 'unknown' }) health!: string;
}
@Entity('network_endpoints')
@Unique(['networkId', 'identity'])
export class NetworkEndpoint {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') networkId!: string;
  @ManyToOne(() => NetworkProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'networkId' })
  network!: NetworkProfile;
  @Column({ select: false }) identity!: string;
  @Column('jsonb', { default: [] }) sourceAgentIds!: string[];
  @Column('varchar', { nullable: true }) mac!: string | null;
  @Column({ length: 100, default: '' }) name!: string;
  @Column({ default: 'unknown' }) category!: string;
  @Column({ default: 'unknown' }) trust!: string;
  @Column({ length: 1000, default: '' }) notes!: string;
  @Column({ default: false }) archived!: boolean;
  @Column('uuid', { nullable: true }) assignedUserId!: string | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignedUserId' })
  assignedUser!: User | null;
  @Column('uuid', { nullable: true }) registeredDeviceId!: string | null;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'registeredDeviceId' })
  registeredDevice!: RegisteredDevice | null;
  @Column('timestamptz') firstSeenAt!: Date;
  @Column('timestamptz') lastSeenAt!: Date;
}
@Entity('network_sightings')
@Unique(['agentId', 'endpointId'])
export class NetworkSighting {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') agentId!: string;
  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent!: Agent;
  @Column('uuid') endpointId!: string;
  @ManyToOne(() => NetworkEndpoint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'endpointId' })
  endpoint!: NetworkEndpoint;
  @Column() address!: string;
  @Column() evidence!: string;
  @Column('timestamptz') observedAt!: Date;
}
@Entity('network_routers')
@Unique(['networkId'])
export class NetworkRouter {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') networkId!: string;
  @ManyToOne(() => NetworkProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'networkId' })
  network!: NetworkProfile;
  @Column('uuid', { nullable: true }) agentId!: string | null;
  @ManyToOne(() => Agent, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'agentId' })
  agent!: Agent | null;
  @Column({ default: 'openwrt-ubus-v1' }) adapter!: string;
  @Column() url!: string;
  @Column({ default: 'wan' }) interfaceName!: string;
  @Column({ default: '' }) caCertificate!: string;
  @Column('text', { nullable: true, select: false }) encryptedCredentials!:
    string | null;
  @Column('integer', { default: 1 }) revision!: number;
  @Column({ length: 100, default: '' }) manufacturer!: string;
  @Column({ length: 100, default: '' }) model!: string;
  @Column({ length: 100, default: '' }) firmware!: string;
  @Column('varchar', { length: 100, nullable: true }) reportedModel!:
    string | null;
  @Column('varchar', { length: 100, nullable: true }) reportedFirmware!:
    string | null;
  @Column('uuid', { nullable: true }) testRequestId!: string | null;
  @Column('timestamptz', { nullable: true }) testRequestedAt!: Date | null;
  @Column({ default: 'not_tested' }) testStatus!: string;
}
@Entity('network_samples')
@Unique(['routerId', 'snapshotId'])
@Index(['routerId', 'observedAt'])
export class NetworkSample {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') routerId!: string;
  @ManyToOne(() => NetworkRouter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routerId' })
  router!: NetworkRouter;
  @Column('uuid') agentId!: string;
  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent!: Agent;
  @Column('uuid') snapshotId!: string;
  @Column('integer') revision!: number;
  @Column('timestamptz') observedAt!: Date;
  @Column() status!: string;
  @Column('boolean', { nullable: true }) wanUp!: boolean | null;
  @Column('bigint', { nullable: true }) uptimeSeconds!: string | null;
  @Column('numeric', { precision: 20, scale: 0, nullable: true }) rxBytes!:
    string | null;
  @Column('numeric', { precision: 20, scale: 0, nullable: true }) txBytes!:
    string | null;
  @Column('numeric', { precision: 20, scale: 0, nullable: true }) rxDelta!:
    string | null;
  @Column('numeric', { precision: 20, scale: 0, nullable: true }) txDelta!:
    string | null;
  @Column('timestamptz', { nullable: true }) intervalStart!: Date | null;
  @Column() quality!: string;
}
@Entity('network_events')
@Index(['networkId', 'occurredAt'])
export class NetworkEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') networkId!: string;
  @ManyToOne(() => NetworkProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'networkId' })
  network!: NetworkProfile;
  @Column('uuid', { nullable: true }) agentId!: string | null;
  @ManyToOne(() => Agent, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'agentId' })
  agent!: Agent | null;
  @Column('uuid', { nullable: true }) endpointId!: string | null;
  @ManyToOne(() => NetworkEndpoint, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'endpointId' })
  endpoint!: NetworkEndpoint | null;
  @Column('uuid', { nullable: true }) actorId!: string | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actorId' })
  actor!: User | null;
  @Column() kind!: string;
  @Column() severity!: string;
  @Column('timestamptz') occurredAt!: Date;
  @Column('timestamptz', { nullable: true }) acknowledgedAt!: Date | null;
}
@Entity('network_compatibility')
export class NetworkCompatibility {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') networkId!: string;
  @ManyToOne(() => NetworkProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'networkId' })
  network!: NetworkProfile;
  @Column({ length: 100 }) manufacturer!: string;
  @Column({ length: 100 }) model!: string;
  @Column({ length: 100 }) firmware!: string;
  @Column({ default: 'openwrt-ubus-v1' }) adapter!: string;
  @Column({ default: 'ubus-session-verified-https' }) authentication!: string;
  @Column({ default: '1.0.0' }) adapterVersion!: string;
  @Column('jsonb') features!: string[];
  @Column({ length: 1000 }) limitations!: string;
  @Column({ length: 1000 }) feedback!: string;
  @Column() evidence!: string;
  @Column('timestamptz') testedAt!: Date;
}

// Observed spans describe repeated cache sightings, never confirmed connection sessions.
@Entity('network_presence')
@Index(['networkId', 'lastObservedAt'])
@Index(['agentId', 'endpointId', 'lastObservedAt'])
export class NetworkPresence {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') networkId!: string;
  @ManyToOne(() => NetworkProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'networkId' })
  network!: NetworkProfile;
  @Column('uuid') agentId!: string;
  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent!: Agent;
  @Column('uuid') endpointId!: string;
  @ManyToOne(() => NetworkEndpoint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'endpointId' })
  endpoint!: NetworkEndpoint;
  @Column() address!: string;
  @Column() evidence!: string;
  @Column('timestamptz') firstObservedAt!: Date;
  @Column('timestamptz') lastObservedAt!: Date;
}
