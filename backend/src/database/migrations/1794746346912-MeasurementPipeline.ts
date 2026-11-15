import { MigrationInterface, QueryRunner } from 'typeorm';

export class MeasurementPipeline1794746346912 implements MigrationInterface {
  name = 'MeasurementPipeline1794746346912';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE registered_devices SET "monitoringEnabled"=false,generation=generation+1 WHERE "monitoringEnabled"=true`,
    );
    await queryRunner.query(
      `CREATE TABLE "monitoring_retention" ("workspaceId" uuid NOT NULL, "rawDays" integer NOT NULL DEFAULT '30', "aggregateDays" integer NOT NULL DEFAULT '365', "alertDays" integer NOT NULL DEFAULT '90', "diagnosticDays" integer NOT NULL DEFAULT '7', CONSTRAINT "PK_9683b696ae3d1d42a95561a7c54" PRIMARY KEY ("workspaceId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "measurements" ("networkId" uuid, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eventId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "deviceId" uuid NOT NULL, "generation" integer NOT NULL, "metric" character varying NOT NULL, "applicationId" character varying NOT NULL DEFAULT '', "quality" character varying NOT NULL, "sourceKind" character varying NOT NULL, "collectorVersion" character varying(100) NOT NULL, "value" numeric(24,6) NOT NULL, "unit" character varying NOT NULL, "intervalStart" TIMESTAMP WITH TIME ZONE NOT NULL, "intervalEnd" TIMESTAMP WITH TIME ZONE NOT NULL, "collectedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a67e7e3a7bfd22dac189aec1998" UNIQUE ("deviceId", "eventId"), CONSTRAINT "PK_3c0e7812563f27fd68e8271661b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d73b90356feb5687925647a8ba" ON "measurements"  ("deviceId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "measurement_receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eventId" uuid NOT NULL, "deviceId" uuid NOT NULL, "payloadHash" character varying NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e8193e3971c4011629721f2e9c8" UNIQUE ("deviceId", "eventId"), CONSTRAINT "PK_08d7914e1578f23f51ef8f97d14" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "measurement_batches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "batchId" uuid NOT NULL, "deviceId" uuid NOT NULL, "payloadHash" character varying NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_70a9a421d7f517b7b9ed9c0f883" UNIQUE ("deviceId", "batchId"), CONSTRAINT "PK_e3e717d020f50d4d443c820c507" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "collection_gaps" ("networkId" uuid, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gapId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "deviceId" uuid NOT NULL, "generation" integer NOT NULL, "metric" character varying NOT NULL, "applicationId" character varying NOT NULL DEFAULT '', "reason" character varying NOT NULL, "payloadHash" character varying NOT NULL, "intervalStart" TIMESTAMP WITH TIME ZONE NOT NULL, "intervalEnd" TIMESTAMP WITH TIME ZONE NOT NULL, "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_90b14cc382ee1cbe9eeb61b8c05" UNIQUE ("deviceId", "gapId"), CONSTRAINT "PK_64db5683d00fa5bcf343a7eab3c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_usage" ("networkId" uuid, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "deviceId" uuid NOT NULL, "seriesKey" character varying NOT NULL, "localDate" date NOT NULL, "timezone" character varying NOT NULL, "metric" character varying NOT NULL, "applicationId" character varying NOT NULL DEFAULT '', "quality" character varying NOT NULL, "sourceKind" character varying NOT NULL, "collectorVersion" character varying(100) NOT NULL, "value" numeric(24,6) NOT NULL, "coverageMs" bigint NOT NULL, "proratedEvents" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_751c19decb983589d857c907946" UNIQUE ("deviceId", "seriesKey", "localDate"), CONSTRAINT "PK_1bd9fdfb7b3346372acc82e8b93" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_52ae9c2cd366ea3730dc9ab42c" ON "daily_usage"  ("deviceId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "monitoring_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "deviceId" uuid, "kind" character varying NOT NULL, "status" character varying NOT NULL, "errorCode" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e3ba35b70fb78b468fa3bc9390b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "usage_networks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "name" character varying(100) NOT NULL, "createdById" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_04c9c81708f032aec57a4c7b6b4" UNIQUE ("workspaceId", "name"), CONSTRAINT "PK_c62cae3eee44557926fe37e9193" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "device_usage_networks" ("deviceId" uuid NOT NULL, "networkId" uuid NOT NULL, CONSTRAINT "PK_589b30307e0da0b0f2b0ded36fb" PRIMARY KEY ("deviceId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "monitoring_retention" ADD CONSTRAINT "FK_9683b696ae3d1d42a95561a7c54" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurements" ADD CONSTRAINT "FK_954224786a5bc3b1f89c43a37c5" FOREIGN KEY ("networkId") REFERENCES "usage_networks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurements" ADD CONSTRAINT "FK_d73b90356feb5687925647a8bac" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurement_receipts" ADD CONSTRAINT "FK_174629d6db1a547ee185ef9b0f5" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurement_batches" ADD CONSTRAINT "FK_529b4afe38adad4b44e7f2d47a2" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection_gaps" ADD CONSTRAINT "FK_ff355e87064de7356cd94b0063f" FOREIGN KEY ("networkId") REFERENCES "usage_networks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection_gaps" ADD CONSTRAINT "FK_266760f7a5e0c9b75e650a472ff" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_usage" ADD CONSTRAINT "FK_32928559e220f31df7e2c808555" FOREIGN KEY ("networkId") REFERENCES "usage_networks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_usage" ADD CONSTRAINT "FK_52ae9c2cd366ea3730dc9ab42c0" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "monitoring_runs" ADD CONSTRAINT "FK_e34349eed0f98621cc8dd1acd08" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "monitoring_runs" ADD CONSTRAINT "FK_15defd9422b21fa9a76da2442b3" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_networks" ADD CONSTRAINT "FK_75ca444e63ce5b04eb8f4a9dc95" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_networks" ADD CONSTRAINT "FK_ab4abb558823869852278c16e14" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_usage_networks" ADD CONSTRAINT "FK_589b30307e0da0b0f2b0ded36fb" FOREIGN KEY ("deviceId") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_usage_networks" ADD CONSTRAINT "FK_b1b078bc3af8064ff3e17097a96" FOREIGN KEY ("networkId") REFERENCES "usage_networks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "device_usage_networks" DROP CONSTRAINT "FK_b1b078bc3af8064ff3e17097a96"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_usage_networks" DROP CONSTRAINT "FK_589b30307e0da0b0f2b0ded36fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_networks" DROP CONSTRAINT "FK_ab4abb558823869852278c16e14"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_networks" DROP CONSTRAINT "FK_75ca444e63ce5b04eb8f4a9dc95"`,
    );
    await queryRunner.query(
      `ALTER TABLE "monitoring_runs" DROP CONSTRAINT "FK_15defd9422b21fa9a76da2442b3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "monitoring_runs" DROP CONSTRAINT "FK_e34349eed0f98621cc8dd1acd08"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_usage" DROP CONSTRAINT "FK_52ae9c2cd366ea3730dc9ab42c0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_usage" DROP CONSTRAINT "FK_32928559e220f31df7e2c808555"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection_gaps" DROP CONSTRAINT "FK_266760f7a5e0c9b75e650a472ff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection_gaps" DROP CONSTRAINT "FK_ff355e87064de7356cd94b0063f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurement_batches" DROP CONSTRAINT "FK_529b4afe38adad4b44e7f2d47a2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurement_receipts" DROP CONSTRAINT "FK_174629d6db1a547ee185ef9b0f5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurements" DROP CONSTRAINT "FK_d73b90356feb5687925647a8bac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "measurements" DROP CONSTRAINT "FK_954224786a5bc3b1f89c43a37c5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "monitoring_retention" DROP CONSTRAINT "FK_9683b696ae3d1d42a95561a7c54"`,
    );
    await queryRunner.query(`DROP TABLE "device_usage_networks"`);
    await queryRunner.query(`DROP TABLE "usage_networks"`);
    await queryRunner.query(`DROP TABLE "monitoring_runs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_52ae9c2cd366ea3730dc9ab42c"`,
    );
    await queryRunner.query(`DROP TABLE "daily_usage"`);
    await queryRunner.query(`DROP TABLE "collection_gaps"`);
    await queryRunner.query(`DROP TABLE "measurement_batches"`);
    await queryRunner.query(`DROP TABLE "measurement_receipts"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d73b90356feb5687925647a8ba"`,
    );
    await queryRunner.query(`DROP TABLE "measurements"`);
    await queryRunner.query(`DROP TABLE "monitoring_retention"`);
  }
}
