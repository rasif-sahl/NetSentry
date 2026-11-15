import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
@Entity('device_events')
export class DeviceEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') deviceId!: string;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice;
  @Column({ type: 'uuid', nullable: true }) actorUserId!: string | null;
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actorUserId' })
  actor!: User | null;
  @Column() kind!: string;
  @Column('integer') generation!: number;
  @Column({ type: 'jsonb', default: {} }) details!: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
