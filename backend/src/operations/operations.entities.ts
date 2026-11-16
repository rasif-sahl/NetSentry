import {
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
@Entity('operator_grants')
export class OperatorGrant {
  @PrimaryColumn('uuid') userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
  @Column() role!: string;
  @Column('jsonb') workspaceIds!: string[];
  @Column('boolean', { default: false }) globalAccounts!: boolean;
  @Column('boolean', { default: false }) globalCatalog!: boolean;
  @Column('timestamptz') expiresAt!: Date;
}
@Entity('operator_audit')
export class OperatorAudit {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid', { nullable: true }) actorId!: string | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actorId' })
  actor!: User | null;
  @Column('uuid', { nullable: true }) workspaceId!: string | null;
  @Column('uuid', { nullable: true }) targetId!: string | null;
  @Column() action!: string;
  @CreateDateColumn({ type: 'timestamptz' }) occurredAt!: Date;
}
@Entity('compatibility_records')
export class CompatibilityRecord {
  @PrimaryColumn() key!: string;
  @Column() kind!: string;
  @Column() label!: string;
  @Column() status!: string;
  @Column({ length: 500 }) evidence!: string;
  @Column('integer', { default: 1 }) revision!: number;
  @Column('timestamptz') checkedAt!: Date;
}
export const operationEntities = [
  OperatorGrant,
  OperatorAudit,
  CompatibilityRecord,
];
