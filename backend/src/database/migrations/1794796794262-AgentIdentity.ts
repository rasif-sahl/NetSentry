import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgentIdentity1794796794262 implements MigrationInterface {
  name = 'AgentIdentity1794796794262';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "installationId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "userId" uuid NOT NULL, "disclosureVersion" character varying NOT NULL DEFAULT 'agent-enrolment-v1', "disclosureHash" character varying NOT NULL, "consentedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "name" character varying(100) NOT NULL, "platform" character varying NOT NULL, "state" character varying NOT NULL DEFAULT 'ACTIVE', "credentialHash" character varying, "generation" integer NOT NULL DEFAULT '1', "modules" jsonb NOT NULL, "backgroundAllowed" boolean NOT NULL DEFAULT false, "lastSeenAt" TIMESTAMP WITH TIME ZONE, "lastSyncedAt" TIMESTAMP WITH TIME ZONE, "version" character varying(100), "architecture" character varying, "capabilities" jsonb NOT NULL DEFAULT '{}', "enrolledAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_cdc9b47a5fe240995debd4ffbde" UNIQUE ("installationId"), CONSTRAINT "PK_9c653f28ae19c5884d5baf6a1d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_enrolments" ("issuedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "disclosureVersion" character varying NOT NULL DEFAULT 'agent-enrolment-v1', "disclosureHash" character varying NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "userId" uuid NOT NULL, "installationId" uuid NOT NULL, "platform" character varying NOT NULL, "name" character varying(100) NOT NULL, "modules" jsonb NOT NULL, "backgroundAllowed" boolean NOT NULL DEFAULT false, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "consumedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_bc17ebc943c368c74798a73ba3d" UNIQUE ("tokenHash"), CONSTRAINT "PK_49fb17a5a46f88aa9bd5a16a8e4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agentId" uuid NOT NULL, "eventId" uuid NOT NULL, "generation" integer NOT NULL, "kind" character varying NOT NULL, "code" character varying NOT NULL, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "payloadHash" character varying NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_4b3ca1ce001d1dcbc76086e0c50" UNIQUE ("agentId", "eventId"), CONSTRAINT "PK_94c713565641b3cfac600e14e94" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0d62b0b9b21474c5d6665d79cf" ON "agent_events"  ("agentId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" ADD CONSTRAINT "FK_891465b3cee1cfe275594eb1cd7" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" ADD CONSTRAINT "FK_f535e5b2c0f0dc7b7fc656ebc91" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_enrolments" ADD CONSTRAINT "FK_1f854dc998980d9eac8440e4382" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_enrolments" ADD CONSTRAINT "FK_d8355c0f369fd409af95016539b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_events" ADD CONSTRAINT "FK_0d62b0b9b21474c5d6665d79cf6" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_events" DROP CONSTRAINT "FK_0d62b0b9b21474c5d6665d79cf6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_enrolments" DROP CONSTRAINT "FK_d8355c0f369fd409af95016539b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_enrolments" DROP CONSTRAINT "FK_1f854dc998980d9eac8440e4382"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" DROP CONSTRAINT "FK_f535e5b2c0f0dc7b7fc656ebc91"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" DROP CONSTRAINT "FK_891465b3cee1cfe275594eb1cd7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0d62b0b9b21474c5d6665d79cf"`,
    );
    await queryRunner.query(`DROP TABLE "agent_events"`);
    await queryRunner.query(`DROP TABLE "agent_enrolments"`);
    await queryRunner.query(`DROP TABLE "agents"`);
  }
}
