import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessOrganizations1794826080866 implements MigrationInterface {
  name = 'BusinessOrganizations1794826080866';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "business_locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "name" character varying(100) NOT NULL, "revision" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_df4217592ca9e2c05d4efd4a7da" UNIQUE ("workspaceId", "name"), CONSTRAINT "PK_64c6863758e121dc12e02c2b7b8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "business_departments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "locationId" uuid NOT NULL, "name" character varying(100) NOT NULL, "revision" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_3fef871b52efa9551bcbc09c48a" UNIQUE ("workspaceId", "name"), CONSTRAINT "PK_d28f37e0c36dc1325eacc89a135" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "business_employees" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "userId" uuid NOT NULL, "departmentId" uuid, "revision" integer NOT NULL DEFAULT '1', "offboardedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_c7b6791c51a943a826b8f59d94a" UNIQUE ("workspaceId", "userId"), CONSTRAINT "PK_4cb4d04451924b82ed2f3cc42fd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "business_assets" ("deviceId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "declaredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "disclosureVersion" character varying NOT NULL DEFAULT 'business-custody-v1', CONSTRAINT "PK_252d3fd0a6629c75f2d4d89bf83" PRIMARY KEY ("deviceId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "business_assignments" ("deviceId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "employeeId" uuid NOT NULL, "generation" integer NOT NULL, "revision" integer NOT NULL DEFAULT '1', "consentedAt" TIMESTAMP WITH TIME ZONE, "reportFrom" date, CONSTRAINT "PK_ae174e90f52135ac5cac8ba975d" PRIMARY KEY ("deviceId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "business_network_locations" ("networkId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "locationId" uuid NOT NULL, CONSTRAINT "PK_89a24e40b3713faffe2ee60cb97" PRIMARY KEY ("networkId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "business_policies" ("workspaceId" uuid NOT NULL, "revision" integer NOT NULL DEFAULT '1', "staleMinutes" integer NOT NULL DEFAULT '1440', "requireMonitoring" boolean NOT NULL DEFAULT false, "requirePermission" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_f8375cf7aaa378711b6fc3b9741" PRIMARY KEY ("workspaceId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "business_alert_assignments" ("eventId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "assigneeId" uuid, "revision" integer NOT NULL DEFAULT '1', "resolvedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6eb4117c2304a89d4c724f1d422" PRIMARY KEY ("eventId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "business_audit" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "actorId" uuid, "action" character varying NOT NULL, "targetId" uuid, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_77865d276c9d01df0e61629bd0c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c0881df5e958e4b0025a4fdc03" ON "business_audit"  ("workspaceId", "occurredAt") `,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."memberships_role_enum" RENAME TO "memberships_role_enum_previous"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."memberships_role_enum" AS ENUM('OWNER','ADMIN','GUARDIAN','MEMBER','VIEWER','NETWORK_ADMIN','ANALYST','EMPLOYEE')`,
    );
    await queryRunner.query(
      `ALTER TABLE memberships ALTER COLUMN role TYPE "public"."memberships_role_enum" USING role::text::"public"."memberships_role_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."memberships_role_enum_previous"`,
    );
    await queryRunner.query(
      `UPDATE memberships SET role='EMPLOYEE' WHERE role='MEMBER' AND "workspaceId" IN (SELECT id FROM workspaces WHERE type='BUSINESS')`,
    );
    await queryRunner.query(
      `UPDATE workspace_invitations SET "revokedAt"=now() WHERE role='MEMBER' AND "workspaceId" IN (SELECT id FROM workspaces WHERE type='BUSINESS') AND "acceptedAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_locations" ADD CONSTRAINT "FK_fbb423d16cdbd893aaebdb9ff02" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_departments" ADD CONSTRAINT "FK_ec6bcbe7e6aab5b64707285ced0" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_departments" ADD CONSTRAINT "FK_bdbf1b6ad4f40be072e07bba417" FOREIGN KEY ("locationId") REFERENCES "business_locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_employees" ADD CONSTRAINT "FK_9436b93f498967ffc40f7340ae7" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_employees" ADD CONSTRAINT "FK_69e86795ea74cdf5bcbc7b2aacd" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_employees" ADD CONSTRAINT "FK_109ebd764f0e20632276c7e0096" FOREIGN KEY ("departmentId") REFERENCES "business_departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_assets" ADD CONSTRAINT "FK_252d3fd0a6629c75f2d4d89bf83" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_assets" ADD CONSTRAINT "FK_5b65b159ec408088905061b0a1f" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_assignments" ADD CONSTRAINT "FK_ae174e90f52135ac5cac8ba975d" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_assignments" ADD CONSTRAINT "FK_5b0a4202ce5104f3b34553673ab" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_assignments" ADD CONSTRAINT "FK_325a01c976b2cbe002059d9ac87" FOREIGN KEY ("employeeId") REFERENCES "business_employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_network_locations" ADD CONSTRAINT "FK_89a24e40b3713faffe2ee60cb97" FOREIGN KEY ("networkId") REFERENCES "usage_networks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_network_locations" ADD CONSTRAINT "FK_fd1c3911dfe334fa584feeeae67" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_network_locations" ADD CONSTRAINT "FK_d37c54646a6e80049812494839a" FOREIGN KEY ("locationId") REFERENCES "business_locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_policies" ADD CONSTRAINT "FK_f8375cf7aaa378711b6fc3b9741" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_alert_assignments" ADD CONSTRAINT "FK_6eb4117c2304a89d4c724f1d422" FOREIGN KEY ("eventId") REFERENCES "network_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_alert_assignments" ADD CONSTRAINT "FK_500e31a5d8c3c3b5a261c4d4acf" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_alert_assignments" ADD CONSTRAINT "FK_924e025c82f8bb986eb571903b6" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_audit" ADD CONSTRAINT "FK_92b61e0c4ea1a19cc8477982d0b" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_audit" ADD CONSTRAINT "FK_fe33cf0bb1ec340beb08a097b03" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_audit" DROP CONSTRAINT "FK_fe33cf0bb1ec340beb08a097b03"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_audit" DROP CONSTRAINT "FK_92b61e0c4ea1a19cc8477982d0b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_alert_assignments" DROP CONSTRAINT "FK_924e025c82f8bb986eb571903b6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_alert_assignments" DROP CONSTRAINT "FK_500e31a5d8c3c3b5a261c4d4acf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_alert_assignments" DROP CONSTRAINT "FK_6eb4117c2304a89d4c724f1d422"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_policies" DROP CONSTRAINT "FK_f8375cf7aaa378711b6fc3b9741"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_network_locations" DROP CONSTRAINT "FK_d37c54646a6e80049812494839a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_network_locations" DROP CONSTRAINT "FK_fd1c3911dfe334fa584feeeae67"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_network_locations" DROP CONSTRAINT "FK_89a24e40b3713faffe2ee60cb97"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_assignments" DROP CONSTRAINT "FK_325a01c976b2cbe002059d9ac87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_assignments" DROP CONSTRAINT "FK_5b0a4202ce5104f3b34553673ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_assignments" DROP CONSTRAINT "FK_ae174e90f52135ac5cac8ba975d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_assets" DROP CONSTRAINT "FK_5b65b159ec408088905061b0a1f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_assets" DROP CONSTRAINT "FK_252d3fd0a6629c75f2d4d89bf83"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_employees" DROP CONSTRAINT "FK_109ebd764f0e20632276c7e0096"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_employees" DROP CONSTRAINT "FK_69e86795ea74cdf5bcbc7b2aacd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_employees" DROP CONSTRAINT "FK_9436b93f498967ffc40f7340ae7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_departments" DROP CONSTRAINT "FK_bdbf1b6ad4f40be072e07bba417"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_departments" DROP CONSTRAINT "FK_ec6bcbe7e6aab5b64707285ced0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_locations" DROP CONSTRAINT "FK_fbb423d16cdbd893aaebdb9ff02"`,
    );
    await queryRunner.query(
      `UPDATE memberships SET role='VIEWER' WHERE role::text IN ('NETWORK_ADMIN','ANALYST','EMPLOYEE')`,
    );
    await queryRunner.query(
      `UPDATE workspace_invitations SET "revokedAt"=now() WHERE role IN ('NETWORK_ADMIN','ANALYST','EMPLOYEE') AND "acceptedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."memberships_role_enum_old" AS ENUM('OWNER', 'ADMIN', 'GUARDIAN', 'MEMBER', 'VIEWER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ALTER COLUMN "role" TYPE "public"."memberships_role_enum_old" USING "role"::"text"::"public"."memberships_role_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."memberships_role_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."memberships_role_enum_old" RENAME TO "memberships_role_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c0881df5e958e4b0025a4fdc03"`,
    );
    await queryRunner.query(`DROP TABLE "business_audit"`);
    await queryRunner.query(`DROP TABLE "business_alert_assignments"`);
    await queryRunner.query(`DROP TABLE "business_policies"`);
    await queryRunner.query(`DROP TABLE "business_network_locations"`);
    await queryRunner.query(`DROP TABLE "business_assignments"`);
    await queryRunner.query(`DROP TABLE "business_assets"`);
    await queryRunner.query(`DROP TABLE "business_employees"`);
    await queryRunner.query(`DROP TABLE "business_departments"`);
    await queryRunner.query(`DROP TABLE "business_locations"`);
  }
}
