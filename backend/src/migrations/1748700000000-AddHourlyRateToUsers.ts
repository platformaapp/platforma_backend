import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHourlyRateToUsers1748700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "hourly_rate" DECIMAL(10,2) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "hourly_rate"
    `);
  }
}
