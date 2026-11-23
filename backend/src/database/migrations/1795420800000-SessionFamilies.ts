import { MigrationInterface, QueryRunner } from 'typeorm';

export class SessionFamilies1795420800000 implements MigrationInterface {
  name = 'SessionFamilies1795420800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE sessions ADD COLUMN "familyId" uuid');
    await queryRunner.query('UPDATE sessions SET "familyId" = id');
    await queryRunner.query(
      'ALTER TABLE sessions ALTER COLUMN "familyId" SET NOT NULL',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_sessions_familyId" ON sessions ("familyId")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_sessions_familyId"');
    await queryRunner.query('ALTER TABLE sessions DROP COLUMN "familyId"');
  }
}
