import { MigrationInterface, QueryRunner } from 'typeorm';

export class NetworkMonitoring1794815016118 implements MigrationInterface {
  name = 'NetworkMonitoring1794815016118';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "network_profiles" ("networkId" uuid NOT NULL, "cidrs" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_11fd3ceb184b6bbf81606a2e92f" PRIMARY KEY ("networkId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "network_collectors" ("agentId" uuid NOT NULL, "networkId" uuid NOT NULL, "generation" integer NOT NULL, "revision" integer NOT NULL DEFAULT '1', "enabled" boolean NOT NULL DEFAULT true, "observedAt" TIMESTAMP WITH TIME ZONE, "snapshotId" uuid, "snapshotHash" character varying, "interfaces" jsonb NOT NULL DEFAULT '[]', "health" character varying NOT NULL DEFAULT 'unknown', CONSTRAINT "PK_a8e636bbec5f9f9c2f7868d9054" PRIMARY KEY ("agentId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "network_endpoints" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "networkId" uuid NOT NULL, "identity" character varying NOT NULL, "sourceAgentIds" jsonb NOT NULL DEFAULT '[]', "mac" character varying, "name" character varying(100) NOT NULL DEFAULT '', "category" character varying NOT NULL DEFAULT 'unknown', "trust" character varying NOT NULL DEFAULT 'unknown', "notes" character varying(1000) NOT NULL DEFAULT '', "archived" boolean NOT NULL DEFAULT false, "assignedUserId" uuid, "registeredDeviceId" uuid, "firstSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL, "lastSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_e236763aa80c3d7e357602ba64a" UNIQUE ("networkId", "identity"), CONSTRAINT "PK_6db5094dc9e66129f8bb8fdf334" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "network_sightings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agentId" uuid NOT NULL, "endpointId" uuid NOT NULL, "address" character varying NOT NULL, "evidence" character varying NOT NULL, "observedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_a8da510f8ca80e93217f263ae6d" UNIQUE ("agentId", "endpointId"), CONSTRAINT "PK_292b0c641f006d613669239f5d7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "network_routers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "networkId" uuid NOT NULL, "agentId" uuid, "adapter" character varying NOT NULL DEFAULT 'openwrt-ubus-v1', "url" character varying NOT NULL, "interfaceName" character varying NOT NULL DEFAULT 'wan', "caCertificate" character varying NOT NULL DEFAULT '', "encryptedCredentials" text, "revision" integer NOT NULL DEFAULT '1', "manufacturer" character varying(100) NOT NULL DEFAULT '', "model" character varying(100) NOT NULL DEFAULT '', "firmware" character varying(100) NOT NULL DEFAULT '', "reportedModel" character varying(100), "reportedFirmware" character varying(100), "testRequestId" uuid, "testRequestedAt" TIMESTAMP WITH TIME ZONE, "testStatus" character varying NOT NULL DEFAULT 'not_tested', CONSTRAINT "UQ_b8b6da895b7d139d505739ea900" UNIQUE ("networkId"), CONSTRAINT "PK_81e522bc77bc239c612b06ff020" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "network_samples" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "routerId" uuid NOT NULL, "agentId" uuid NOT NULL, "snapshotId" uuid NOT NULL, "revision" integer NOT NULL, "observedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying NOT NULL, "wanUp" boolean, "uptimeSeconds" bigint, "rxBytes" numeric(20,0), "txBytes" numeric(20,0), "rxDelta" numeric(20,0), "txDelta" numeric(20,0), "intervalStart" TIMESTAMP WITH TIME ZONE, "quality" character varying NOT NULL, CONSTRAINT "UQ_7aa1e20344b798204c0add18249" UNIQUE ("routerId", "snapshotId"), CONSTRAINT "PK_6347b60a8e0bb8396f05e1db3cc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_78d87fbcda32cc483ac7b8be38" ON "network_samples"  ("routerId", "observedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "network_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "networkId" uuid NOT NULL, "agentId" uuid, "endpointId" uuid, "actorId" uuid, "kind" character varying NOT NULL, "severity" character varying NOT NULL, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "acknowledgedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4ed699cc0722013bf8e3733cd8a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_67ce7a32c4d984ddfde1a9cfeb" ON "network_events"  ("networkId", "occurredAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "network_compatibility" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "networkId" uuid NOT NULL, "manufacturer" character varying(100) NOT NULL, "model" character varying(100) NOT NULL, "firmware" character varying(100) NOT NULL, "adapter" character varying NOT NULL DEFAULT 'openwrt-ubus-v1', "authentication" character varying NOT NULL DEFAULT 'ubus-session-verified-https', "adapterVersion" character varying NOT NULL DEFAULT '1.0.0', "features" jsonb NOT NULL, "limitations" character varying(1000) NOT NULL, "feedback" character varying(1000) NOT NULL, "evidence" character varying NOT NULL, "testedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_467b84300173e1bfcc955d048b3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "network_presence" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "networkId" uuid NOT NULL, "agentId" uuid NOT NULL, "endpointId" uuid NOT NULL, "address" character varying NOT NULL, "evidence" character varying NOT NULL, "firstObservedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "lastObservedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_a1031deccb3be1f0a1aa59919b2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8d8102efd92ca8590db5efdf54" ON "network_presence"  ("agentId", "endpointId", "lastObservedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1fbaf210fc433332a3b26eaffc" ON "network_presence"  ("networkId", "lastObservedAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "network_profiles" ADD CONSTRAINT "FK_11fd3ceb184b6bbf81606a2e92f" FOREIGN KEY ("networkId") REFERENCES "usage_networks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_collectors" ADD CONSTRAINT "FK_a8e636bbec5f9f9c2f7868d9054" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_collectors" ADD CONSTRAINT "FK_458dd641781c6f23ff8a74347f3" FOREIGN KEY ("networkId") REFERENCES "network_profiles"("networkId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_endpoints" ADD CONSTRAINT "FK_c816898aff96b2c17c8fee93ba3" FOREIGN KEY ("networkId") REFERENCES "network_profiles"("networkId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_endpoints" ADD CONSTRAINT "FK_2c6671fea8269cc4afa039b1258" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_endpoints" ADD CONSTRAINT "FK_af466cba823a384ce1924ed1cd6" FOREIGN KEY ("registeredDeviceId") REFERENCES "registered_devices"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_sightings" ADD CONSTRAINT "FK_5ee70b86cdbd55cc18b91a70423" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_sightings" ADD CONSTRAINT "FK_40d8f34a0ee3270df4da176fe6a" FOREIGN KEY ("endpointId") REFERENCES "network_endpoints"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_routers" ADD CONSTRAINT "FK_b8b6da895b7d139d505739ea900" FOREIGN KEY ("networkId") REFERENCES "network_profiles"("networkId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_routers" ADD CONSTRAINT "FK_dee6be91bad973b81bf71bdf488" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_samples" ADD CONSTRAINT "FK_fd16312ac16ef4aa73b7fa22890" FOREIGN KEY ("routerId") REFERENCES "network_routers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_samples" ADD CONSTRAINT "FK_c41faef63771a1b2c39a69a37b8" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_events" ADD CONSTRAINT "FK_980dc70f14ef05b6641ebd6ab5f" FOREIGN KEY ("networkId") REFERENCES "network_profiles"("networkId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_events" ADD CONSTRAINT "FK_3ca31706ffd98c9898df0960564" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_events" ADD CONSTRAINT "FK_86d972a4cee9eab7cf5fad18ebc" FOREIGN KEY ("endpointId") REFERENCES "network_endpoints"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_events" ADD CONSTRAINT "FK_7f46abbd3e635d192f016a893b6" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_compatibility" ADD CONSTRAINT "FK_09b4d1dda6bfcfd92180f4b4728" FOREIGN KEY ("networkId") REFERENCES "network_profiles"("networkId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_presence" ADD CONSTRAINT "FK_3219e240348cb09d416bd9e0d97" FOREIGN KEY ("networkId") REFERENCES "network_profiles"("networkId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_presence" ADD CONSTRAINT "FK_439a2b858df1f05999a76a004a5" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_presence" ADD CONSTRAINT "FK_090fd7e5047d5bbb93d7fa56843" FOREIGN KEY ("endpointId") REFERENCES "network_endpoints"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "network_presence" DROP CONSTRAINT "FK_090fd7e5047d5bbb93d7fa56843"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_presence" DROP CONSTRAINT "FK_439a2b858df1f05999a76a004a5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_presence" DROP CONSTRAINT "FK_3219e240348cb09d416bd9e0d97"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_compatibility" DROP CONSTRAINT "FK_09b4d1dda6bfcfd92180f4b4728"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_events" DROP CONSTRAINT "FK_7f46abbd3e635d192f016a893b6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_events" DROP CONSTRAINT "FK_86d972a4cee9eab7cf5fad18ebc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_events" DROP CONSTRAINT "FK_3ca31706ffd98c9898df0960564"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_events" DROP CONSTRAINT "FK_980dc70f14ef05b6641ebd6ab5f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_samples" DROP CONSTRAINT "FK_c41faef63771a1b2c39a69a37b8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_samples" DROP CONSTRAINT "FK_fd16312ac16ef4aa73b7fa22890"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_routers" DROP CONSTRAINT "FK_dee6be91bad973b81bf71bdf488"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_routers" DROP CONSTRAINT "FK_b8b6da895b7d139d505739ea900"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_sightings" DROP CONSTRAINT "FK_40d8f34a0ee3270df4da176fe6a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_sightings" DROP CONSTRAINT "FK_5ee70b86cdbd55cc18b91a70423"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_endpoints" DROP CONSTRAINT "FK_af466cba823a384ce1924ed1cd6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_endpoints" DROP CONSTRAINT "FK_2c6671fea8269cc4afa039b1258"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_endpoints" DROP CONSTRAINT "FK_c816898aff96b2c17c8fee93ba3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_collectors" DROP CONSTRAINT "FK_458dd641781c6f23ff8a74347f3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_collectors" DROP CONSTRAINT "FK_a8e636bbec5f9f9c2f7868d9054"`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_profiles" DROP CONSTRAINT "FK_11fd3ceb184b6bbf81606a2e92f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1fbaf210fc433332a3b26eaffc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8d8102efd92ca8590db5efdf54"`,
    );
    await queryRunner.query(`DROP TABLE "network_presence"`);
    await queryRunner.query(`DROP TABLE "network_compatibility"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_67ce7a32c4d984ddfde1a9cfeb"`,
    );
    await queryRunner.query(`DROP TABLE "network_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_78d87fbcda32cc483ac7b8be38"`,
    );
    await queryRunner.query(`DROP TABLE "network_samples"`);
    await queryRunner.query(`DROP TABLE "network_routers"`);
    await queryRunner.query(`DROP TABLE "network_sightings"`);
    await queryRunner.query(`DROP TABLE "network_endpoints"`);
    await queryRunner.query(`DROP TABLE "network_collectors"`);
    await queryRunner.query(`DROP TABLE "network_profiles"`);
  }
}
