import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountRecovery1794740400652 implements MigrationInterface {
  name = 'AccountRecovery1794740400652';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "account_actions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "purpose" character varying(32) NOT NULL, "tokenHash" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "consumedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_1f68692f0eaf6eb8b7cad710295" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_307bf9c84a236067764ff53530" ON "account_actions"  ("tokenHash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mail_outbox" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "encryptedPayload" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "sentAt" TIMESTAMP WITH TIME ZONE, "claimedUntil" TIMESTAMP WITH TIME ZONE, "discardedAt" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_fecc63c96385bc35a39ccf2a72e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8d39e8125ebde484be98ffd433" ON "mail_outbox"  ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "emailVerifiedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_actions" ADD CONSTRAINT "FK_62a18a0c83b01ff78b9843d225b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mail_outbox" ADD CONSTRAINT "FK_8d39e8125ebde484be98ffd4332" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mail_outbox" DROP CONSTRAINT "FK_8d39e8125ebde484be98ffd4332"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_actions" DROP CONSTRAINT "FK_62a18a0c83b01ff78b9843d225b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "emailVerifiedAt"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8d39e8125ebde484be98ffd433"`,
    );
    await queryRunner.query(`DROP TABLE "mail_outbox"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_307bf9c84a236067764ff53530"`,
    );
    await queryRunner.query(`DROP TABLE "account_actions"`);
  }
}
