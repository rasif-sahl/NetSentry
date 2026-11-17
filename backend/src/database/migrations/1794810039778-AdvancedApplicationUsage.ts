import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdvancedApplicationUsage1794810039778 implements MigrationInterface {
  name = 'AdvancedApplicationUsage1794810039778';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "application_catalogs" ("deviceId" uuid NOT NULL, "applications" jsonb NOT NULL DEFAULT '[]', "categories" jsonb NOT NULL DEFAULT '[]', "overrides" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_7ffbcb09ab39e2e1b5478374402" PRIMARY KEY ("deviceId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "application_windows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deviceId" uuid NOT NULL, "batchId" uuid NOT NULL, "intervalStart" TIMESTAMP WITH TIME ZONE NOT NULL, "intervalEnd" TIMESTAMP WITH TIME ZONE NOT NULL, "payload" jsonb NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f3272bd15e7c09204237a060483" UNIQUE ("deviceId", "batchId"), CONSTRAINT "PK_f4ba761f20f2e46981ffc300c73" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "application_days" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deviceId" uuid NOT NULL, "applicationId" character varying NOT NULL, "localDate" date NOT NULL, "timezone" character varying NOT NULL, "durationMs" bigint NOT NULL, "lateNightMs" bigint NOT NULL, "coverageMs" bigint NOT NULL, "observedLaunches" integer NOT NULL, "launchesComplete" boolean NOT NULL, "firstUse" TIMESTAMP WITH TIME ZONE, "lastUse" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_379b89b20e173d0d82f6e8aa7be" UNIQUE ("deviceId", "applicationId", "localDate", "timezone"), CONSTRAINT "PK_16eba5a03e5c45292946029cc79" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_catalogs" ADD CONSTRAINT "FK_7ffbcb09ab39e2e1b5478374402" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_windows" ADD CONSTRAINT "FK_c0f19afd23fcf82742fe8c41f84" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_days" ADD CONSTRAINT "FK_01952399d642bb92cfff4976fdc" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "application_days" DROP CONSTRAINT "FK_01952399d642bb92cfff4976fdc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_windows" DROP CONSTRAINT "FK_c0f19afd23fcf82742fe8c41f84"`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_catalogs" DROP CONSTRAINT "FK_7ffbcb09ab39e2e1b5478374402"`,
    );
    await queryRunner.query(`DROP TABLE "application_days"`);
    await queryRunner.query(`DROP TABLE "application_windows"`);
    await queryRunner.query(`DROP TABLE "application_catalogs"`);
  }
}
