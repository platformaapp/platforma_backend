import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSeoFieldsToArticles1792100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles"
      ADD COLUMN IF NOT EXISTS "seo_title" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "h1" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "meta_description" VARCHAR(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles"
      DROP COLUMN IF EXISTS "seo_title",
      DROP COLUMN IF EXISTS "h1",
      DROP COLUMN IF EXISTS "meta_description"
    `);
  }
}
