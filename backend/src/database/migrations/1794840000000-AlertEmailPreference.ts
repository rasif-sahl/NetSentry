import { MigrationInterface, QueryRunner } from 'typeorm';
export class AlertEmailPreference1794840000000 implements MigrationInterface {
  name = 'AlertEmailPreference1794840000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "notification_preferences" ADD "email" boolean NOT NULL DEFAULT false',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the new opt-in/channel history before older code reads its enums.
    await queryRunner.query(
      "DELETE FROM notification_deliveries WHERE channel='email'",
    );
    await queryRunner.query(
      `UPDATE alert_rules SET config=jsonb_set(config,'{channels}',(config->'channels')-'email') WHERE config->'channels' ? 'email'`,
    );
    await queryRunner.query(
      `UPDATE alert_rules SET config=jsonb_set(config,'{enabled}','false'::jsonb) WHERE jsonb_array_length(config->'channels')=0`,
    );
    await queryRunner.query(
      'ALTER TABLE "notification_preferences" DROP COLUMN "email"',
    );
  }
}
