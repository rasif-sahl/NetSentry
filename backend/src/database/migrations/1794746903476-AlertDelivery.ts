import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertDelivery1794746903476 implements MigrationInterface {
  name = 'AlertDelivery1794746903476';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "alert_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "userId" uuid NOT NULL, "deviceId" uuid, "networkId" uuid, "config" jsonb NOT NULL, "windowKey" character varying NOT NULL DEFAULT '', "active" boolean NOT NULL DEFAULT false, "cycle" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ae580564f087ffab9d229225aec" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ruleId" uuid NOT NULL, "cycle" integer NOT NULL, "sourceDeviceIds" jsonb NOT NULL, "snapshot" jsonb NOT NULL, "acknowledgedAt" TIMESTAMP WITH TIME ZONE, "resolvedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_eb8eee319bfce2b1f84f2cf9f7d" UNIQUE ("ruleId", "cycle"), CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alertId" uuid NOT NULL, "channel" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "dueAt" TIMESTAMP WITH TIME ZONE NOT NULL, "attemptHistory" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "UQ_d7ec9a52a0f4545dbe52053f03a" UNIQUE ("alertId", "channel"), CONSTRAINT "PK_81daeff81f237bd384f7cfc4a4c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_preferences" ("userId" uuid NOT NULL, "inApp" boolean NOT NULL DEFAULT true, "push" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_b70c44e8b00757584a393225593" PRIMARY KEY ("userId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_rules" ADD CONSTRAINT "FK_db8100014edaa28739c296aca1d" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_rules" ADD CONSTRAINT "FK_b1073c34d9de2ae50a0abd9616f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_rules" ADD CONSTRAINT "FK_1a0167f4f2aaa0f894e2f80bca1" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_rules" ADD CONSTRAINT "FK_7e9855790ba48ccdaf6c773162d" FOREIGN KEY ("networkId") REFERENCES "usage_networks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "FK_ef1e576efeb7e09651a740f3287" FOREIGN KEY ("ruleId") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_deliveries" ADD CONSTRAINT "FK_a3453c796515a47f71432bb7b14" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preferences" ADD CONSTRAINT "FK_b70c44e8b00757584a393225593" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_preferences" DROP CONSTRAINT "FK_b70c44e8b00757584a393225593"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_deliveries" DROP CONSTRAINT "FK_a3453c796515a47f71432bb7b14"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "FK_ef1e576efeb7e09651a740f3287"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_rules" DROP CONSTRAINT "FK_7e9855790ba48ccdaf6c773162d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_rules" DROP CONSTRAINT "FK_1a0167f4f2aaa0f894e2f80bca1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_rules" DROP CONSTRAINT "FK_b1073c34d9de2ae50a0abd9616f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_rules" DROP CONSTRAINT "FK_db8100014edaa28739c296aca1d"`,
    );
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(`DROP TABLE "notification_deliveries"`);
    await queryRunner.query(`DROP TABLE "alerts"`);
    await queryRunner.query(`DROP TABLE "alert_rules"`);
  }
}
