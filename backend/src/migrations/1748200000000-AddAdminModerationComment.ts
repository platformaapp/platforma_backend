import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminModerationComment1748200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS admin_moderation_comment TEXT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE events DROP COLUMN IF EXISTS admin_moderation_comment;
    `);
  }
}
