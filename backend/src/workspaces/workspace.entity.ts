import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
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
  @Column({ default: 'UTC' }) timezone!: string;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
  @OneToMany(() => Membership, (membership) => membership.workspace)
  memberships!: Membership[];
  @OneToMany(() => RegisteredDevice, (device) => device.workspace)
  devices!: RegisteredDevice[];
}
