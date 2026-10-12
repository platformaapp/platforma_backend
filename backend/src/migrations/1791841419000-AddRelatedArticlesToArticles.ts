import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRelatedArticlesToArticles1791841419000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles"
      ADD COLUMN IF NOT EXISTS "related_article_ids" UUID[] NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles" DROP COLUMN IF EXISTS "related_article_ids"
    `);
  }
}
