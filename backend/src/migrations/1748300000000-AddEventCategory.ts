import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventCategory1748300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE event_category_enum AS ENUM (
          'broadcast', 'lecture', 'mediation', 'practices', 'meeting', 'discussion'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS category event_category_enum NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events DROP COLUMN IF EXISTS category;`);
    await queryRunner.query(`DROP TYPE IF EXISTS event_category_enum;`);
  }
}
