import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Agent } from './agent.entities';
import { User } from '../users/user.entity';
@Entity('agent_developer')
export class AgentDeveloper {
  @PrimaryColumn('uuid') agentId!: string;
  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent!: Agent;
  @Column('integer') generation!: number;
  @Column('integer', { default: 1 }) revision!: number;
  @Column({ default: false }) sharingAllowed!: boolean;
  @Column('jsonb', { default: [] }) controllers!: string[];
  @Column('jsonb', { default: [] }) services!: RemoteService[];
  @Column('jsonb', { default: [] }) observations!: RemoteService[];
  @Column({ default: false }) localControlReady!: boolean;
  @Column({ default: false }) platformSupported!: boolean;
  @Column('integer', { default: 0 }) total!: number;
  @Column('timestamptz', { nullable: true }) reportedAt!: Date | null;
  @Column({ default: 'developer-sharing-v1' }) disclosureVersion!: string;
  @Column('timestamptz') consentedAt!: Date;
}
export type RemoteService = {
  serviceId: string;
  observationId: string;
  pid: number;
  startedAt: string;
  observedAt: string;
  runtime: string;
  project: string;
  ports: number[];
  canStop: boolean;
  childCount: number;
};
@Entity('developer_commands')
@Unique(['agentId', 'requesterId', 'requestId'])
export class DeveloperCommand {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') agentId!: string;
  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent!: Agent;
  @Column('uuid') requesterId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requesterId' })
  requester!: User;
  @Column('uuid') requestId!: string;
  @Column('integer') generation!: number;
  @Column('integer') revision!: number;
  @Column('jsonb') target!: RemoteService;
  @Column() mode!: string;
  @Column({ default: false }) includeChildren!: boolean;
  @Column({ select: false }) fingerprint!: string;
  @Column({ default: 'pending' }) state!: string;
  @Column('varchar', { nullable: true }) outcome!: string | null;
  @Column('varchar', { nullable: true, select: false }) leaseHash!:
    string | null;
  @CreateDateColumn({ type: 'timestamptz' }) requestedAt!: Date;
  @Column('timestamptz') expiresAt!: Date;
  @Column('timestamptz', { nullable: true }) acceptedAt!: Date | null;
  @Column('timestamptz', { nullable: true }) startedAt!: Date | null;
  @Column('timestamptz', { nullable: true }) completedAt!: Date | null;
}
@Entity('developer_audit')
export class DeveloperAudit {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') commandId!: string;
  @ManyToOne(() => DeveloperCommand, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commandId' })
  command!: DeveloperCommand;
  @Column() event!: string;
  @Column() outcome!: string;
  @CreateDateColumn({ type: 'timestamptz' }) occurredAt!: Date;
}
