import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index()
  @Column('uuid')
  userId!: string;
  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
  @Column({ select: false }) refreshTokenHash!: string;
  @Column({ nullable: true }) userAgent!: string | null;
  @Column({ nullable: true }) ipAddress!: string | null;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() lastUsedAt!: Date;
}
