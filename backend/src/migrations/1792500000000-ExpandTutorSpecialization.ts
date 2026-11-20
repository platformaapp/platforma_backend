import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandTutorSpecialization1792500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN specialization TYPE text`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL rejects rollback if longer values exist; never truncate content.
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN specialization TYPE varchar(255)`);
  }
}
