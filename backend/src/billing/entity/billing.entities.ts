import {
  Column,
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
} from 'typeorm';
import { Workspace } from '../../workspaces/entity/workspace.entity';
import { User } from '../../users/entity/user.entity';
@Entity('workspace_subscriptions')
export class Subscription {
  @PrimaryColumn('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column({ default: 'free' }) plan!: string;
  @Column({ default: 'monthly' }) interval!: string;
  @Column({ default: 'free' }) status!: string;
  @Column('integer', { default: 0 }) revision!: number;
  @Column('integer', { default: 0 }) lastSequence!: number;
  @Column('boolean', { default: false }) trialUsed!: boolean;
  @Column('timestamptz', { nullable: true }) trialEndsAt!: Date | null;
  @Column('timestamptz', { nullable: true }) periodEnd!: Date | null;
  @Column('timestamptz', { nullable: true }) graceUntil!: Date | null;
  @Column('boolean', { default: false }) cancelAtPeriodEnd!: boolean;
  @Column({ default: 'none' }) provider!: string;
}
@Entity('billing_requests')
@Unique(['workspaceId', 'requestId'])
export class BillingRequest {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('uuid') requestId!: string;
  @Column('uuid') requesterId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requesterId' })
  requester!: User;
  @Column() plan!: string;
  @Column() interval!: string;
  @Column('integer') expectedRevision!: number;
  @Column({ default: 'pending' }) status!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
@Entity('billing_events')
@Unique(['workspaceId', 'sequence'])
export class BillingEvent {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('integer') sequence!: number;
  @Column({ select: false }) payloadHash!: string;
  @Column() outcome!: string;
  @Column('timestamptz') occurredAt!: Date;
  @CreateDateColumn({ type: 'timestamptz' }) receivedAt!: Date;
}
@Entity('billing_payments')
export class Payment {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @Column('bigint') amountMinor!: string;
  @Column({ length: 3 }) currency!: string;
  @Column() status!: string;
  @Column({ default: 'sandbox' }) provider!: string;
  @Column('timestamptz') paidAt!: Date;
}
@Entity('feature_settings')
export class FeatureSetting {
  @PrimaryColumn() scope!: string;
  @PrimaryColumn() key!: string;
  @Column('boolean') enabled!: boolean;
  @Column('integer', { default: 1 }) revision!: number;
}
export const billingEntities = [
  Subscription,
  BillingRequest,
  BillingEvent,
  Payment,
  FeatureSetting,
];
