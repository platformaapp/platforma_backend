import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPayoutsSystem1748000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Payout method + destination on users
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "payout_method" VARCHAR(20) NULL,
      ADD COLUMN IF NOT EXISTS "payout_destination" VARCHAR(255) NULL
    `);

    // Payout status enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "tutor_payouts_status_enum" AS ENUM ('pending', 'succeeded', 'canceled', 'failed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Payout method enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "tutor_payouts_method_enum" AS ENUM ('bank_card', 'sbp');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_payouts" (
        "id"                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "tutor_id"            UUID NOT NULL REFERENCES "users"("id"),
        "amount"              DECIMAL(10,2) NOT NULL,
        "currency"            VARCHAR(3) NOT NULL DEFAULT 'RUB',
        "status"              "tutor_payouts_status_enum" NOT NULL DEFAULT 'pending',
        "method"              "tutor_payouts_method_enum" NOT NULL,
        "destination_masked"  VARCHAR(255) NOT NULL,
        "yookassa_payout_id"  VARCHAR NULL,
        "error_message"       TEXT NULL,
        "processed_at"        TIMESTAMPTZ NULL,
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tutor_payouts_tutor_id" ON "tutor_payouts" ("tutor_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tutor_payouts"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tutor_payouts_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tutor_payouts_method_enum"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "payout_method",
      DROP COLUMN IF EXISTS "payout_destination"
    `);
  }
}
