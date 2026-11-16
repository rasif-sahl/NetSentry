import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessEndpointDepartments1794827947493 implements MigrationInterface {
  name = 'BusinessEndpointDepartments1794827947493';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "business_endpoint_departments" ("endpointId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "departmentId" uuid, "revision" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_047979e848d7b54811bcec14aeb" PRIMARY KEY ("endpointId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_endpoint_departments" ADD CONSTRAINT "FK_047979e848d7b54811bcec14aeb" FOREIGN KEY ("endpointId") REFERENCES "network_endpoints"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_endpoint_departments" ADD CONSTRAINT "FK_cf0189f33da04f89de7fb6c28f4" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_endpoint_departments" ADD CONSTRAINT "FK_b50d18fc5173e0fd2d5cdd32fd0" FOREIGN KEY ("departmentId") REFERENCES "business_departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_endpoint_departments" DROP CONSTRAINT "FK_b50d18fc5173e0fd2d5cdd32fd0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_endpoint_departments" DROP CONSTRAINT "FK_cf0189f33da04f89de7fb6c28f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_endpoint_departments" DROP CONSTRAINT "FK_047979e848d7b54811bcec14aeb"`,
    );
    await queryRunner.query(`DROP TABLE "business_endpoint_departments"`);
  }
}
