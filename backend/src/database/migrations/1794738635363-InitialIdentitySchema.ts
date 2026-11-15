import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialIdentitySchema1794738635363 implements MigrationInterface {
  name = 'InitialIdentitySchema1794738635363';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'users',
      'sessions',
      'workspaces',
      'memberships',
      'registered_devices',
    ]) {
      if (await queryRunner.hasTable(table)) {
        throw new Error(
          'Existing application tables found. Verify the schema and use db:adopt instead of applying the initial migration.',
        );
      }
    }
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(
      `CREATE TYPE "public"."registered_devices_platform_enum" AS ENUM('ANDROID', 'IOS', 'WINDOWS', 'MACOS', 'WEB', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "registered_devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "installationId" character varying NOT NULL, "workspaceId" uuid NOT NULL, "registeredById" uuid NOT NULL, "name" character varying(100) NOT NULL, "platform" "public"."registered_devices_platform_enum" NOT NULL, "operatingSystemVersion" character varying, "capabilities" jsonb NOT NULL DEFAULT '{}'::jsonb, "lastSeenAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_61081a01a87d36925178e40d9a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3c3f2f239b2e41107b6e21f048" ON "registered_devices"  ("installationId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."workspaces_type_enum" AS ENUM('PERSONAL', 'FAMILY', 'BUSINESS')`,
    );
    await queryRunner.query(
      `CREATE TABLE "workspaces" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "type" "public"."workspaces_type_enum" NOT NULL, "ownerId" uuid NOT NULL, "timezone" character varying NOT NULL DEFAULT 'UTC', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_098656ae401f3e1a4586f47fd8e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."memberships_role_enum" AS ENUM('OWNER', 'ADMIN', 'GUARDIAN', 'MEMBER', 'VIEWER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."memberships_role_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b4aa57a22a5eb10228c7b21a8fc" UNIQUE ("workspaceId", "userId"), CONSTRAINT "PK_25d28bd932097a9e90495ede7b4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'PENDING_DELETION', 'SUSPENDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "displayName" character varying(100) NOT NULL, "passwordHash" character varying NOT NULL, "status" "public"."users_status_enum" NOT NULL DEFAULT 'ACTIVE', "preferences" jsonb NOT NULL DEFAULT '{}'::jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "refreshTokenHash" character varying NOT NULL, "userAgent" character varying, "ipAddress" character varying, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "lastUsedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_57de40bc620f456c7311aa3a1e" ON "sessions"  ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" ADD CONSTRAINT "FK_3dc2bf19fc2971706ab8317a90c" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "FK_5a480a4394c7b8a74da1cb66a2f" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "FK_187d573e43b2c2aa3960df20b78" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP CONSTRAINT "FK_187d573e43b2c2aa3960df20b78"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP CONSTRAINT "FK_5a480a4394c7b8a74da1cb66a2f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_devices" DROP CONSTRAINT "FK_3dc2bf19fc2971706ab8317a90c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_57de40bc620f456c7311aa3a1e"`,
    );
    await queryRunner.query(`DROP TABLE "sessions"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`DROP TABLE "memberships"`);
    await queryRunner.query(`DROP TYPE "public"."memberships_role_enum"`);
    await queryRunner.query(`DROP TABLE "workspaces"`);
    await queryRunner.query(`DROP TYPE "public"."workspaces_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3c3f2f239b2e41107b6e21f048"`,
    );
    await queryRunner.query(`DROP TABLE "registered_devices"`);
    await queryRunner.query(
      `DROP TYPE "public"."registered_devices_platform_enum"`,
    );
  }
}
