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
import { User } from '../../users/entity/user.entity';

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
  @Column({ type: 'varchar', nullable: true }) userAgent!: string | null;
  @Column({ type: 'varchar', nullable: true }) ipAddress!: string | null;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() lastUsedAt!: Date;
}
