import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArticleBannerUrls1792400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "articles"
      ADD COLUMN IF NOT EXISTS "banner_image_url" text,
      ADD COLUMN IF NOT EXISTS "banner_link_url" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "articles"
      DROP COLUMN IF EXISTS "banner_link_url",
      DROP COLUMN IF EXISTS "banner_image_url"`);
  }
}
