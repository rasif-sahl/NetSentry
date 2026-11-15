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
import { Workspace } from './workspace.entity';

export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  GUARDIAN = 'GUARDIAN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

@Entity('memberships')
@Unique(['workspaceId', 'userId'])
export class Membership {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') workspaceId!: string;
  @Column('uuid') userId!: string;
  @Column({ type: 'enum', enum: WorkspaceRole }) role!: WorkspaceRole;
  @ManyToOne(() => Workspace, (workspace) => workspace.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: Workspace;
  @ManyToOne(() => User, (user) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
  @CreateDateColumn() createdAt!: Date;
}
