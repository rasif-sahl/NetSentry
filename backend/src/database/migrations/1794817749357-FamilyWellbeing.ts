import { MigrationInterface, QueryRunner } from 'typeorm';

export class FamilyWellbeing1794817749357 implements MigrationInterface {
  name = 'FamilyWellbeing1794817749357';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "family_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "name" character varying(80) NOT NULL, "avatar" character varying NOT NULL, "ageBand" character varying NOT NULL, "userId" uuid, "guardians" jsonb NOT NULL DEFAULT '[]', "networks" jsonb NOT NULL DEFAULT '[]', "archived" boolean NOT NULL DEFAULT false, "revision" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_109cfc17fecc3eca6267576cae3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "family_assignments" ("deviceId" uuid NOT NULL, "profileId" uuid NOT NULL, "generation" integer NOT NULL, "profileRevision" integer NOT NULL, "consentedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "disclosureVersion" character varying NOT NULL DEFAULT 'family-sharing-v1', CONSTRAINT "PK_4b8a50fcb98e3938e730818df9d" PRIMARY KEY ("deviceId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "family_policies" ("profileId" uuid NOT NULL, "revision" integer NOT NULL DEFAULT '1', "rules" jsonb NOT NULL, "timezone" character varying NOT NULL, "authorId" uuid, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_def9d7bf8e6c351b0490ea262f1" PRIMARY KEY ("profileId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "family_requests" ("id" uuid NOT NULL, "profileId" uuid NOT NULL, "requesterId" uuid, "policyRevision" integer NOT NULL, "minutes" integer NOT NULL, "reason" character varying(200) NOT NULL, "state" character varying NOT NULL, "requestedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "decidedBy" uuid, "decidedAt" TIMESTAMP WITH TIME ZONE, "overrideUntil" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_3b4720f5323408d95b7acda606d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "family_receipts" ("deviceId" uuid NOT NULL, "policyRevision" integer NOT NULL, "profileRevision" integer NOT NULL, "generation" integer NOT NULL, "status" character varying NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_cca68b81a6cd2f0afd173bce1d5" PRIMARY KEY ("deviceId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "family_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profileId" uuid NOT NULL, "actorId" uuid, "kind" character varying NOT NULL, "detail" jsonb NOT NULL DEFAULT '{}', "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_63b2f114baaf8c7d4f63cf12b17" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e0770456c2cb782b6df804a709" ON "family_events"  ("profileId", "occurredAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "family_profiles" ADD CONSTRAINT "FK_9524d587b661009d5e9372fbec0" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_profiles" ADD CONSTRAINT "FK_142846f8c0e4d2abd3b8c677a14" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_assignments" ADD CONSTRAINT "FK_4b8a50fcb98e3938e730818df9d" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_assignments" ADD CONSTRAINT "FK_2c4dd91d7d0029015115cfe75ca" FOREIGN KEY ("profileId") REFERENCES "family_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_policies" ADD CONSTRAINT "FK_def9d7bf8e6c351b0490ea262f1" FOREIGN KEY ("profileId") REFERENCES "family_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_policies" ADD CONSTRAINT "FK_67b05a3f3c8a2a7cf440e844301" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_requests" ADD CONSTRAINT "FK_b62bbc3f78325ef9262d3d7c166" FOREIGN KEY ("profileId") REFERENCES "family_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_requests" ADD CONSTRAINT "FK_aa4d02e23c39abad7de86b593b8" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_requests" ADD CONSTRAINT "FK_7d43705df9ce3a14e95b9cf4e5e" FOREIGN KEY ("decidedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_receipts" ADD CONSTRAINT "FK_cca68b81a6cd2f0afd173bce1d5" FOREIGN KEY ("deviceId") REFERENCES "family_assignments"("deviceId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_events" ADD CONSTRAINT "FK_1422b25551d2b0a27185cb6e9a1" FOREIGN KEY ("profileId") REFERENCES "family_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_events" ADD CONSTRAINT "FK_5712cbae5a2ca94d6d13bf0e2d4" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "family_events" DROP CONSTRAINT "FK_5712cbae5a2ca94d6d13bf0e2d4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_events" DROP CONSTRAINT "FK_1422b25551d2b0a27185cb6e9a1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_receipts" DROP CONSTRAINT "FK_cca68b81a6cd2f0afd173bce1d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_requests" DROP CONSTRAINT "FK_7d43705df9ce3a14e95b9cf4e5e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_requests" DROP CONSTRAINT "FK_aa4d02e23c39abad7de86b593b8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_requests" DROP CONSTRAINT "FK_b62bbc3f78325ef9262d3d7c166"`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_policies" DROP CONSTRAINT "FK_67b05a3f3c8a2a7cf440e844301"`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_policies" DROP CONSTRAINT "FK_def9d7bf8e6c351b0490ea262f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_assignments" DROP CONSTRAINT "FK_2c4dd91d7d0029015115cfe75ca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_assignments" DROP CONSTRAINT "FK_4b8a50fcb98e3938e730818df9d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_profiles" DROP CONSTRAINT "FK_142846f8c0e4d2abd3b8c677a14"`,
    );
    await queryRunner.query(
      `ALTER TABLE "family_profiles" DROP CONSTRAINT "FK_9524d587b661009d5e9372fbec0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e0770456c2cb782b6df804a709"`,
    );
    await queryRunner.query(`DROP TABLE "family_events"`);
    await queryRunner.query(`DROP TABLE "family_receipts"`);
    await queryRunner.query(`DROP TABLE "family_requests"`);
    await queryRunner.query(`DROP TABLE "family_policies"`);
    await queryRunner.query(`DROP TABLE "family_assignments"`);
    await queryRunner.query(`DROP TABLE "family_profiles"`);
  }
}
