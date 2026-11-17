import { MigrationInterface, QueryRunner } from 'typeorm';
export class DeploymentWorkerState1794931200000 implements MigrationInterface {
  name = 'DeploymentWorkerState1794931200000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "deployment_worker_state" (
      "name" character varying(32) NOT NULL PRIMARY KEY,
      "cursor" uuid,
      "status" character varying(16) NOT NULL DEFAULT 'idle',
      "lastStartedAt" TIMESTAMP WITH TIME ZONE,
      "lastCompletedAt" TIMESTAMP WITH TIME ZONE,
      "lastSucceededAt" TIMESTAMP WITH TIME ZONE,
      "processed" integer NOT NULL DEFAULT 0,
      "failures" integer NOT NULL DEFAULT 0
    )`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "deployment_worker_state"');
  }
}
