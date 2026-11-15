import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrivacyHistory1794742051386 implements MigrationInterface {
  name = 'PrivacyHistory1794742051386';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "privacy_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "kind" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e017d90da9d6b09a1ef470c756d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_344b553f3732afeef1ad9825d3" ON "privacy_events"  ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "privacy_events" ADD CONSTRAINT "FK_344b553f3732afeef1ad9825d36" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "privacy_events" DROP CONSTRAINT "FK_344b553f3732afeef1ad9825d36"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_344b553f3732afeef1ad9825d3"`,
    );
    await queryRunner.query(`DROP TABLE "privacy_events"`);
  }
}
