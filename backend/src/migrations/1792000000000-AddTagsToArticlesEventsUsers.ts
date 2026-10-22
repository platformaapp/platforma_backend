import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTagsToArticlesEventsUsers1792000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles"
      ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}'
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}'
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "articles" DROP COLUMN IF EXISTS "tags"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN IF EXISTS "tags"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "tags"`);
  }
}
