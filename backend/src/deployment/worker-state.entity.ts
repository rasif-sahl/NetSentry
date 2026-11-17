import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('deployment_worker_state')
export class DeploymentWorkerState {
  @PrimaryColumn({ type: 'varchar', length: 32 }) name!: string;
  @Column({ type: 'uuid', nullable: true }) cursor!: string | null;
  @Column({ type: 'varchar', length: 16, default: 'idle' }) status!: string;
  @Column({ type: 'timestamptz', nullable: true }) lastStartedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true })
  lastCompletedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true })
  lastSucceededAt!: Date | null;
  @Column({ type: 'int', default: 0 }) processed!: number;
  @Column({ type: 'int', default: 0 }) failures!: number;
}
