import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlockAndCommission1746461000000 implements MigrationInterface {
  name = 'AddBlockAndCommission1746461000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "is_blocked"       boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "commission_rate"  numeric(5,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "events"
        ADD COLUMN IF NOT EXISTS "is_blocked" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_settings" (
        "key"         character varying(100) NOT NULL,
        "value"       text NOT NULL,
        "updated_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_settings" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "platform_settings" ("key", "value")
      VALUES ('commission_rate', '0')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_settings"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN IF EXISTS "is_blocked"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "commission_rate"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_blocked"`);
  }
}
