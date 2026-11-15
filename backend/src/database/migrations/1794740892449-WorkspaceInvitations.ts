import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkspaceInvitations1794740892449 implements MigrationInterface {
  name = 'WorkspaceInvitations1794740892449';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "workspace_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "createdById" uuid NOT NULL, "email" character varying NOT NULL, "role" character varying NOT NULL, "tokenHash" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "acceptedAt" TIMESTAMP WITH TIME ZONE, "revokedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_525b9069dc828a8ee8fdc62c32c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_92e35608aee47991b38c8921e6" ON "workspace_invitations"  ("tokenHash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_65515eaafd8282c3848bddbb008" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_15ecac78bfb9be8a803040ab31e" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" DROP CONSTRAINT "FK_15ecac78bfb9be8a803040ab31e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" DROP CONSTRAINT "FK_65515eaafd8282c3848bddbb008"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_92e35608aee47991b38c8921e6"`,
    );
    await queryRunner.query(`DROP TABLE "workspace_invitations"`);
  }
}
