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
@Entity('privacy_events')
export class PrivacyEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
  @Column() kind!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
