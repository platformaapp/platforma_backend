import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShowBannerToArticles1791916104000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles"
      ADD COLUMN IF NOT EXISTS "show_banner" BOOLEAN NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles" DROP COLUMN IF EXISTS "show_banner"
    `);
  }
}
