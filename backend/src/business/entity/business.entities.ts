import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Workspace } from '../../workspaces/entity/workspace.entity';
import { User } from '../../users/entity/user.entity';
import { RegisteredDevice } from '../../workspaces/entity/registered-device.entity';
import { UsageNetwork } from '../../monitoring/entity/entities';
import {
  NetworkEvent,
  NetworkEndpoint,
} from '../../networks/entity/network.entities';

@Entity('business_locations')
@Unique(['workspaceId', 'name'])
export class BusinessLocation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column({ length: 100 }) name!: string;
  @Column('integer', { default: 1 }) revision!: number;
}
@Entity('business_departments')
@Unique(['workspaceId', 'name'])
export class BusinessDepartment {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('uuid') locationId!: string;
  @ManyToOne(() => BusinessLocation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location!: BusinessLocation;
  @Column({ length: 100 }) name!: string;
  @Column('integer', { default: 1 }) revision!: number;
}
@Entity('business_employees')
@Unique(['workspaceId', 'userId'])
export class BusinessEmployee {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('uuid') userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
  @Column('uuid', { nullable: true }) departmentId!: string | null;
  @ManyToOne(() => BusinessDepartment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'departmentId' })
  department!: BusinessDepartment | null;
  @Column('integer', { default: 1 }) revision!: number;
  @Column('timestamptz', { nullable: true }) offboardedAt!: Date | null;
}
@Entity('business_assets')
export class BusinessAsset {
  @PrimaryColumn('uuid') deviceId!: string;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('timestamptz') declaredAt!: Date;
  @Column({ default: 'business-custody-v1' }) disclosureVersion!: string;
}
@Entity('business_assignments')
export class BusinessAssignment {
  @PrimaryColumn('uuid') deviceId!: string;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('uuid') employeeId!: string;
  @ManyToOne(() => BusinessEmployee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee!: BusinessEmployee;
  @Column('integer') generation!: number;
  @Column('integer', { default: 1 }) revision!: number;
  @Column('timestamptz', { nullable: true }) consentedAt!: Date | null;
  @Column('date', { nullable: true }) reportFrom!: string | null;
}
@Entity('business_network_locations')
export class BusinessNetworkLocation {
  @PrimaryColumn('uuid') networkId!: string;
  @ManyToOne(() => UsageNetwork, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'networkId' })
  network!: UsageNetwork;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('uuid') locationId!: string;
  @ManyToOne(() => BusinessLocation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location!: BusinessLocation;
}
@Entity('business_policies')
export class BusinessPolicy {
  @PrimaryColumn('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('integer', { default: 1 }) revision!: number;
  @Column('integer', { default: 1440 }) staleMinutes!: number;
  @Column('boolean', { default: false }) requireMonitoring!: boolean;
  @Column('boolean', { default: false }) requirePermission!: boolean;
}
@Entity('business_alert_assignments')
export class BusinessAlertAssignment {
  @PrimaryColumn('uuid') eventId!: string;
  @ManyToOne(() => NetworkEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event!: NetworkEvent;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('uuid', { nullable: true }) assigneeId!: string | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigneeId' })
  assignee!: User | null;
  @Column('integer', { default: 1 }) revision!: number;
  @Column('timestamptz', { nullable: true }) resolvedAt!: Date | null;
}
@Entity('business_endpoint_departments')
export class BusinessEndpointDepartment {
  @PrimaryColumn('uuid') endpointId!: string;
  @ManyToOne(() => NetworkEndpoint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'endpointId' })
  endpoint!: NetworkEndpoint;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('uuid', { nullable: true }) departmentId!: string | null;
  @ManyToOne(() => BusinessDepartment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'departmentId' })
  department!: BusinessDepartment | null;
  @Column('integer', { default: 1 }) revision!: number;
}
@Entity('business_audit')
@Index(['workspaceId', 'occurredAt'])
export class BusinessAudit {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('uuid', { nullable: true }) actorId!: string | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actorId' })
  actor!: User | null;
  @Column() action!: string;
  @Column('uuid', { nullable: true }) targetId!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) occurredAt!: Date;
}
export const businessEntities = [
  BusinessEndpointDepartment,
  BusinessLocation,
  BusinessDepartment,
  BusinessEmployee,
  BusinessAsset,
  BusinessAssignment,
  BusinessNetworkLocation,
  BusinessPolicy,
  BusinessAlertAssignment,
  BusinessAudit,
];
