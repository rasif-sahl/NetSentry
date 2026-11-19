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
import { User } from '../../users/entity/user.entity';
import { Workspace } from '../../workspaces/entity/workspace.entity';
export type Modules = { network: boolean; developer: boolean };
@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid', { unique: true }) installationId!: string;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('uuid') userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
  @Column({ default: 'agent-enrolment-v1' }) disclosureVersion!: string;
  @Column() disclosureHash!: string;
  @Column('timestamptz') consentedAt!: Date;
  @Column({ length: 100 }) name!: string;
  @Column() platform!: string;
  @Column({ default: 'ACTIVE' }) state!: string;
  @Column({ type: 'varchar', nullable: true, select: false }) credentialHash!:
    string | null;
  @Column('integer', { default: 1 }) generation!: number;
  @Column('jsonb') modules!: Modules;
  @Column({ default: false }) backgroundAllowed!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) lastSeenAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lastSyncedAt!: Date | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) version!:
    string | null;
  @Column({ type: 'varchar', nullable: true }) architecture!: string | null;
  @Column('jsonb', { default: {} }) capabilities!: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) enrolledAt!: Date;
}
@Entity('agent_enrolments')
export class AgentEnrolment {
  @CreateDateColumn({ type: 'timestamptz' }) issuedAt!: Date;
  @Column({ default: 'agent-enrolment-v1' }) disclosureVersion!: string;
  @Column() disclosureHash!: string;
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('uuid') userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
  @Column('uuid') installationId!: string;
  @Column() platform!: string;
  @Column({ length: 100 }) name!: string;
  @Column('jsonb') modules!: Modules;
  @Column({ default: false }) backgroundAllowed!: boolean;
  @Column({ unique: true, select: false }) tokenHash!: string;
  @Column('timestamptz') expiresAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) consumedAt!: Date | null;
}
@Entity('agent_events')
@Unique(['agentId', 'eventId'])
export class AgentEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') agentId!: string;
  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent!: Agent;
  @Column('uuid') eventId!: string;
  @Column('integer') generation!: number;
  @Column() kind!: string;
  @Column() code!: string;
  @Column('timestamptz') occurredAt!: Date;
  @Column({ select: false }) payloadHash!: string;
  @CreateDateColumn({ type: 'timestamptz' }) receivedAt!: Date;
}
