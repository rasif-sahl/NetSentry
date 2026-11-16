import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
import type { FamilyRules } from './family.rules';
@Entity('family_profiles')
export class FamilyProfile {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column({ length: 80 }) name!: string;
  @Column() avatar!: string;
  @Column() ageBand!: string;
  @Column('uuid', { nullable: true }) userId!: string | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user!: User | null;
  @Column('jsonb', { default: [] }) guardians!: string[];
  @Column('jsonb', { default: [] }) networks!: string[];
  @Column({ default: false }) archived!: boolean;
  @Column('integer', { default: 1 }) revision!: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
@Entity('family_assignments')
export class FamilyAssignment {
  @Column('uuid', { primary: true }) deviceId!: string;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice;
  @Column('uuid') profileId!: string;
  @ManyToOne(() => FamilyProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profileId' })
  profile!: FamilyProfile;
  @Column('integer') generation!: number;
  @Column('integer') profileRevision!: number;
  @Column('timestamptz') consentedAt!: Date;
  @Column({ default: 'family-sharing-v1' }) disclosureVersion!: string;
}
@Entity('family_policies')
export class FamilyPolicy {
  @Column('uuid', { primary: true }) profileId!: string;
  @ManyToOne(() => FamilyProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profileId' })
  profile!: FamilyProfile;
  @Column('integer', { default: 1 }) revision!: number;
  @Column('jsonb') rules!: FamilyRules;
  @Column() timezone!: string;
  @Column('uuid', { nullable: true }) authorId!: string | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'authorId' })
  author!: User | null;
  @Column('timestamptz') updatedAt!: Date;
}
@Entity('family_requests')
export class FamilyRequest {
  @Column('uuid', { primary: true }) id!: string;
  @Column('uuid') profileId!: string;
  @ManyToOne(() => FamilyProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profileId' })
  profile!: FamilyProfile;
  @Column('uuid', { nullable: true }) requesterId!: string | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'requesterId' })
  requester!: User | null;
  @Column('integer') policyRevision!: number;
  @Column('integer') minutes!: number;
  @Column({ length: 200 }) reason!: string;
  @Column() state!: string;
  @Column('timestamptz') requestedAt!: Date;
  @Column('timestamptz') expiresAt!: Date;
  @Column('uuid', { nullable: true }) decidedBy!: string | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'decidedBy' })
  decider!: User | null;
  @Column('timestamptz', { nullable: true }) decidedAt!: Date | null;
  @Column('timestamptz', { nullable: true }) overrideUntil!: Date | null;
}
@Entity('family_receipts')
export class FamilyReceipt {
  @Column('uuid', { primary: true }) deviceId!: string;
  @ManyToOne(() => FamilyAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  assignment!: FamilyAssignment;
  @Column('integer') policyRevision!: number;
  @Column('integer') profileRevision!: number;
  @Column('integer') generation!: number;
  @Column() status!: string;
  @Column('timestamptz') receivedAt!: Date;
}
@Entity('family_events')
@Index(['profileId', 'occurredAt'])
export class FamilyEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') profileId!: string;
  @ManyToOne(() => FamilyProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profileId' })
  profile!: FamilyProfile;
  @Column('uuid', { nullable: true }) actorId!: string | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actorId' })
  actor!: User | null;
  @Column() kind!: string;
  @Column('jsonb', { default: {} }) detail!: Record<string, unknown>;
  @Column('timestamptz') occurredAt!: Date;
}
