import { createHash } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class RetainedIntervalIndex1794747169411 implements MigrationInterface {
  name = 'RetainedIntervalIndex1794747169411';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE monitoring_retention ADD "effectiveAt" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurement_receipts" ADD "partitionHash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurement_receipts" ADD "intervalStart" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurement_receipts" ADD "intervalEnd" TIMESTAMP WITH TIME ZONE`,
    );
    let cursor = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const rows = await queryRunner.query(
        `SELECT r.id,m.metric,m."applicationId",m.quality,m."intervalStart",m."intervalEnd" FROM measurement_receipts r JOIN measurements m ON m."deviceId"=r."deviceId" AND m."eventId"=r."eventId" WHERE r.id>$1 ORDER BY r.id LIMIT 1000`,
        [cursor],
      );
      if (!rows.length) break;
      for (const row of rows)
        await queryRunner.query(
          `UPDATE measurement_receipts SET "partitionHash"=$2,"intervalStart"=$3,"intervalEnd"=$4 WHERE id=$1`,
          [
            row.id,
            createHash('sha256')
              .update(
                JSON.stringify([row.metric, row.applicationId, row.quality]),
              )
              .digest('hex'),
            row.intervalStart,
            row.intervalEnd,
          ],
        );
      cursor = rows[rows.length - 1].id;
    }
    // Older receipts without raw intervals remain null; ingestion fails closed until erased/expired.
    await queryRunner.query(
      `UPDATE registered_devices SET "monitoringEnabled"=false,generation=generation+1 WHERE "monitoringEnabled"=true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE monitoring_retention DROP COLUMN "effectiveAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurement_receipts" DROP COLUMN "intervalEnd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurement_receipts" DROP COLUMN "intervalStart"`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurement_receipts" DROP COLUMN "partitionHash"`,
    );
  }
}
