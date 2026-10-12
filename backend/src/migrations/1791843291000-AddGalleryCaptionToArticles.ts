import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGalleryCaptionToArticles1791843291000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles"
      ADD COLUMN IF NOT EXISTS "gallery_caption" TEXT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles" DROP COLUMN IF EXISTS "gallery_caption"
    `);
  }
}
