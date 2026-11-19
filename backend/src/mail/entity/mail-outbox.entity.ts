import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entity/user.entity';

@Entity('mail_outbox')
export class MailOutbox {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
  @Column({ type: 'text', select: false }) encryptedPayload!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) sentAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) claimedUntil!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) discardedAt!: Date | null;
  @Column({ type: 'integer', default: 0 }) attempts!: number;
}
