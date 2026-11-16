import { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingOperations1794830599789 implements MigrationInterface {
  name = 'BillingOperations1794830599789';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "operator_grants" ("userId" uuid NOT NULL, "role" character varying NOT NULL, "workspaceIds" jsonb NOT NULL, "globalAccounts" boolean NOT NULL DEFAULT false, "globalCatalog" boolean NOT NULL DEFAULT false, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_19b81ed4e42d33644ba78809606" PRIMARY KEY ("userId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "operator_audit" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actorId" uuid, "workspaceId" uuid, "targetId" uuid, "action" character varying NOT NULL, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a8b3a0f3ea7cf7e4a0911811655" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "compatibility_records" ("key" character varying NOT NULL, "kind" character varying NOT NULL, "label" character varying NOT NULL, "status" character varying NOT NULL, "evidence" character varying(500) NOT NULL, "revision" integer NOT NULL DEFAULT '1', "checkedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_5c7149f027c46648accaf536e24" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "workspace_subscriptions" ("workspaceId" uuid NOT NULL, "plan" character varying NOT NULL DEFAULT 'free', "interval" character varying NOT NULL DEFAULT 'monthly', "status" character varying NOT NULL DEFAULT 'free', "revision" integer NOT NULL DEFAULT '0', "lastSequence" integer NOT NULL DEFAULT '0', "trialUsed" boolean NOT NULL DEFAULT false, "trialEndsAt" TIMESTAMP WITH TIME ZONE, "periodEnd" TIMESTAMP WITH TIME ZONE, "graceUntil" TIMESTAMP WITH TIME ZONE, "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false, "provider" character varying NOT NULL DEFAULT 'none', CONSTRAINT "PK_bf174cdc32ae4c928feacc61c74" PRIMARY KEY ("workspaceId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "billing_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "requestId" uuid NOT NULL, "requesterId" uuid NOT NULL, "plan" character varying NOT NULL, "interval" character varying NOT NULL, "expectedRevision" integer NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_617647e165c3dc6792b892c9aca" UNIQUE ("workspaceId", "requestId"), CONSTRAINT "PK_dd9efd27ccda35f83f38b3bd4f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "billing_events" ("id" uuid NOT NULL, "workspaceId" uuid NOT NULL, "sequence" integer NOT NULL, "payloadHash" character varying NOT NULL, "outcome" character varying NOT NULL, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_56e92426168100b11a308a66cda" UNIQUE ("workspaceId", "sequence"), CONSTRAINT "PK_9a4a4a1b1f55bbc868f6a76a597" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "billing_payments" ("id" uuid NOT NULL, "workspaceId" uuid NOT NULL, "amountMinor" bigint NOT NULL, "currency" character varying(3) NOT NULL, "status" character varying NOT NULL, "provider" character varying NOT NULL DEFAULT 'sandbox', "paidAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_c4e4866a41953b04f9229b273ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "feature_settings" ("scope" character varying NOT NULL, "key" character varying NOT NULL, "enabled" boolean NOT NULL, "revision" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_853227aa593b86c5990fc352a5a" PRIMARY KEY ("scope", "key"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "operator_grants" ADD CONSTRAINT "FK_19b81ed4e42d33644ba78809606" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "operator_audit" ADD CONSTRAINT "FK_c794df5ad205deedaf85e94fd63" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "FK_bf174cdc32ae4c928feacc61c74" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "billing_requests" ADD CONSTRAINT "FK_2ab87fb8076d85aa00a496169ff" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "billing_requests" ADD CONSTRAINT "FK_aea191f7037a534fd740df88e01" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "billing_events" ADD CONSTRAINT "FK_98c3df1ff143a1072d76e723655" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "billing_payments" ADD CONSTRAINT "FK_624260c278bc637ab2fa9d5e192" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "billing_payments" DROP CONSTRAINT "FK_624260c278bc637ab2fa9d5e192"`,
    );
    await queryRunner.query(
      `ALTER TABLE "billing_events" DROP CONSTRAINT "FK_98c3df1ff143a1072d76e723655"`,
    );
    await queryRunner.query(
      `ALTER TABLE "billing_requests" DROP CONSTRAINT "FK_aea191f7037a534fd740df88e01"`,
    );
    await queryRunner.query(
      `ALTER TABLE "billing_requests" DROP CONSTRAINT "FK_2ab87fb8076d85aa00a496169ff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_subscriptions" DROP CONSTRAINT "FK_bf174cdc32ae4c928feacc61c74"`,
    );
    await queryRunner.query(
      `ALTER TABLE "operator_audit" DROP CONSTRAINT "FK_c794df5ad205deedaf85e94fd63"`,
    );
    await queryRunner.query(
      `ALTER TABLE "operator_grants" DROP CONSTRAINT "FK_19b81ed4e42d33644ba78809606"`,
    );
    await queryRunner.query(`DROP TABLE "feature_settings"`);
    await queryRunner.query(`DROP TABLE "billing_payments"`);
    await queryRunner.query(`DROP TABLE "billing_events"`);
    await queryRunner.query(`DROP TABLE "billing_requests"`);
    await queryRunner.query(`DROP TABLE "workspace_subscriptions"`);
    await queryRunner.query(`DROP TABLE "compatibility_records"`);
    await queryRunner.query(`DROP TABLE "operator_audit"`);
    await queryRunner.query(`DROP TABLE "operator_grants"`);
  }
}
