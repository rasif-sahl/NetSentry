import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { RegisteredDevice } from '../../workspaces/entity/registered-device.entity';
export type AppCategory = { id: string; name: string };
export type AppMetadata = {
  applicationId: string;
  label: string | null;
  platformCategory: string;
};
@Entity('application_catalogs')
export class ApplicationCatalog {
  @Column('uuid', { primary: true }) deviceId!: string;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice;
  @Column('jsonb', { default: [] }) applications!: AppMetadata[];
  @Column('jsonb', { default: [] }) categories!: AppCategory[];
  @Column('jsonb', { default: {} }) overrides!: Record<string, string>;
}
@Entity('application_windows')
@Unique(['deviceId', 'batchId'])
export class ApplicationWindow {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') deviceId!: string;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice;
  @Column('uuid') batchId!: string;
  @Column('timestamptz') intervalStart!: Date;
  @Column('timestamptz') intervalEnd!: Date;
  @Column('jsonb') payload!: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) receivedAt!: Date;
}
@Entity('application_days')
@Unique(['deviceId', 'applicationId', 'localDate', 'timezone'])
export class ApplicationDay {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') deviceId!: string;
  @ManyToOne(() => RegisteredDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device!: RegisteredDevice;
  @Column() applicationId!: string;
  @Column('date') localDate!: string;
  @Column() timezone!: string;
  @Column('bigint') durationMs!: string;
  @Column('bigint') lateNightMs!: string;
  @Column('bigint') coverageMs!: string;
  @Column('integer') observedLaunches!: number;
  @Column('boolean') launchesComplete!: boolean;
  @Column('timestamptz', { nullable: true }) firstUse!: Date | null;
  @Column('timestamptz', { nullable: true }) lastUse!: Date | null;
}
