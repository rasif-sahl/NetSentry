import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Membership } from './membership.entity';
import { RegisteredDevice } from './registered-device.entity';

export enum WorkspaceType {
  PERSONAL = 'PERSONAL',
  FAMILY = 'FAMILY',
  BUSINESS = 'BUSINESS',
}

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 100 }) name!: string;
  @Column({ type: 'enum', enum: WorkspaceType }) type!: WorkspaceType;
  @Column('uuid') ownerId!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ownerId' })
  owner!: User;
  @Column({ default: 'UTC' }) timezone!: string;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
  @OneToMany(() => Membership, (membership) => membership.workspace)
  memberships!: Membership[];
  @OneToMany(() => RegisteredDevice, (device) => device.workspace)
  devices!: RegisteredDevice[];
}
