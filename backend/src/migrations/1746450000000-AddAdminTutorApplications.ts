import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminTutorApplications1746450000000 implements MigrationInterface {
  name = 'AddAdminTutorApplications1746450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "specialization" character varying(255)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_applications" (
        "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"          uuid NOT NULL,
        "status"           character varying(20) NOT NULL DEFAULT 'pending',
        "rejection_reason" text,
        "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tutor_applications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tutor_applications_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tutor_applications"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "specialization"`);
  }
}
