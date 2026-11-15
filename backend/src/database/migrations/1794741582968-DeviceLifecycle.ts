import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeviceLifecycle1794741582968 implements MigrationInterface {
  name = 'DeviceLifecycle1794741582968';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "device_enrolments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "installationId" character varying NOT NULL, "platform" character varying NOT NULL, "tokenHash" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "consumedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_501d30d20120a34ff5acef74825" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_37b4949a7d44d2e7869f408662" ON "device_enrolments"  ("tokenHash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "device_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deviceId" uuid NOT NULL, "actorUserId" uuid, "kind" character varying NOT NULL, "generation" integer NOT NULL, "details" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_808a12fa2283a05c70277d1bfd7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_65d6c2849094d90ec933592490" ON "device_events"  ("deviceId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "state" character varying NOT NULL DEFAULT 'UNVERIFIED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "credentialHash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "generation" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "monitoringEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "consentScopes" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "enrolledAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "revokedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "removedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "lastSyncedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "applicationVersion" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "deviceModel" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "batteryOptimizationStatus" character varying NOT NULL DEFAULT 'unknown'`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "permissionStatus" character varying NOT NULL DEFAULT 'unknown'`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "monitoringHealth" character varying NOT NULL DEFAULT 'unknown'`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD "capabilityReport" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD CONSTRAINT "FK_128a0e0cd434669fba4c2ba908e" FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD CONSTRAINT "FK_77607c5b6af821ec294d33aab0c" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_enrolments" ADD CONSTRAINT "FK_8137ae19584c602572987401963" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_enrolments" ADD CONSTRAINT "FK_460678f5de5464c3ba4a40aade8" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_events" ADD CONSTRAINT "FK_65d6c2849094d90ec933592490f" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_events" ADD CONSTRAINT "FK_b81d4ee54f6e61667a80e664988" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "device_events" DROP CONSTRAINT "FK_b81d4ee54f6e61667a80e664988"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_events" DROP CONSTRAINT "FK_65d6c2849094d90ec933592490f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_enrolments" DROP CONSTRAINT "FK_460678f5de5464c3ba4a40aade8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_enrolments" DROP CONSTRAINT "FK_8137ae19584c602572987401963"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP CONSTRAINT "FK_77607c5b6af821ec294d33aab0c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP CONSTRAINT "FK_128a0e0cd434669fba4c2ba908e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "capabilityReport"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "monitoringHealth"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "permissionStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "batteryOptimizationStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "deviceModel"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "applicationVersion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "lastSyncedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "removedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "revokedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "enrolledAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "consentScopes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "monitoringEnabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "generation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "credentialHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP COLUMN "state"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_65d6c2849094d90ec933592490"`,
    );
    await queryRunner.query(`DROP TABLE "device_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_37b4949a7d44d2e7869f408662"`,
    );
    await queryRunner.query(`DROP TABLE "device_enrolments"`);
  }
}
