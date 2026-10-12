import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventIdToArticles1791842317000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles"
      ADD COLUMN IF NOT EXISTS "event_id" UUID NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles" DROP COLUMN IF EXISTS "event_id"
    `);
  }
}
