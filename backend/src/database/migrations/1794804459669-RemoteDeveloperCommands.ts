import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoteDeveloperCommands1794804459669 implements MigrationInterface {
  name = 'RemoteDeveloperCommands1794804459669';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agent_developer" ("agentId" uuid NOT NULL, "generation" integer NOT NULL, "revision" integer NOT NULL DEFAULT '1', "sharingAllowed" boolean NOT NULL DEFAULT false, "controllers" jsonb NOT NULL DEFAULT '[]', "services" jsonb NOT NULL DEFAULT '[]', "observations" jsonb NOT NULL DEFAULT '[]', "localControlReady" boolean NOT NULL DEFAULT false, "platformSupported" boolean NOT NULL DEFAULT false, "total" integer NOT NULL DEFAULT '0', "reportedAt" TIMESTAMP WITH TIME ZONE, "disclosureVersion" character varying NOT NULL DEFAULT 'developer-sharing-v1', "consentedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_ca907a78299d6718c4d881d2de0" PRIMARY KEY ("agentId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "developer_commands" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agentId" uuid NOT NULL, "requesterId" uuid NOT NULL, "requestId" uuid NOT NULL, "generation" integer NOT NULL, "revision" integer NOT NULL, "target" jsonb NOT NULL, "mode" character varying NOT NULL, "includeChildren" boolean NOT NULL DEFAULT false, "fingerprint" character varying NOT NULL, "state" character varying NOT NULL DEFAULT 'pending', "outcome" character varying, "leaseHash" character varying, "requestedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "acceptedAt" TIMESTAMP WITH TIME ZONE, "startedAt" TIMESTAMP WITH TIME ZONE, "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_e7e948b838a8495b5e4ca199bed" UNIQUE ("agentId", "requesterId", "requestId"), CONSTRAINT "PK_546c0231969efffedc14ab9f4f3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_20637ac7586889a1709263b5e1" ON "developer_commands"  ("agentId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "developer_audit" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "commandId" uuid NOT NULL, "event" character varying NOT NULL, "outcome" character varying NOT NULL, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f4de564bf6970c4c127839ff5f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f6417f8917dd111349dff6f4fa" ON "developer_audit"  ("commandId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_developer" ADD CONSTRAINT "FK_ca907a78299d6718c4d881d2de0" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "developer_commands" ADD CONSTRAINT "FK_20637ac7586889a1709263b5e11" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "developer_commands" ADD CONSTRAINT "FK_8b52e1ab64dab96b956915a9c9c" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "developer_audit" ADD CONSTRAINT "FK_f6417f8917dd111349dff6f4fae" FOREIGN KEY ("commandId") REFERENCES "developer_commands"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "developer_audit" DROP CONSTRAINT "FK_f6417f8917dd111349dff6f4fae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "developer_commands" DROP CONSTRAINT "FK_8b52e1ab64dab96b956915a9c9c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "developer_commands" DROP CONSTRAINT "FK_20637ac7586889a1709263b5e11"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_developer" DROP CONSTRAINT "FK_ca907a78299d6718c4d881d2de0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f6417f8917dd111349dff6f4fa"`,
    );
    await queryRunner.query(`DROP TABLE "developer_audit"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_20637ac7586889a1709263b5e1"`,
    );
    await queryRunner.query(`DROP TABLE "developer_commands"`);
    await queryRunner.query(`DROP TABLE "agent_developer"`);
  }
}
