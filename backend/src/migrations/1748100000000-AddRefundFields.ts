import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefundFields1748100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'refunded' to the enum used by user_events.payment_status
    await queryRunner.query(`
      DO $$
      DECLARE type_name TEXT;
      BEGIN
        SELECT pg_type.typname INTO type_name
        FROM pg_attribute
        JOIN pg_type ON pg_type.oid = pg_attribute.atttypid
        JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_class.relname = 'user_events'
          AND pg_attribute.attname = 'payment_status'
          AND pg_namespace.nspname = 'public';

        IF type_name IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM pg_enum
          JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
          WHERE pg_type.typname = type_name AND pg_enum.enumlabel = 'refunded'
        ) THEN
          EXECUTE 'ALTER TYPE ' || type_name || ' ADD VALUE ''refunded''';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "user_events"
      ADD COLUMN IF NOT EXISTS "yookassa_refund_id" VARCHAR NULL,
      ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMPTZ NULL
    `);

    // Add 'refunded' to the enum used by payments.status
    await queryRunner.query(`
      DO $$
      DECLARE type_name TEXT;
      BEGIN
        SELECT pg_type.typname INTO type_name
        FROM pg_attribute
        JOIN pg_type ON pg_type.oid = pg_attribute.atttypid
        JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_class.relname = 'payments'
          AND pg_attribute.attname = 'status'
          AND pg_namespace.nspname = 'public';

        IF type_name IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM pg_enum
          JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
          WHERE pg_type.typname = type_name AND pg_enum.enumlabel = 'refunded'
        ) THEN
          EXECUTE 'ALTER TYPE ' || type_name || ' ADD VALUE ''refunded''';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "yookassa_refund_id" VARCHAR NULL,
      ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_events"
      DROP COLUMN IF EXISTS "yookassa_refund_id",
      DROP COLUMN IF EXISTS "refunded_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP COLUMN IF EXISTS "yookassa_refund_id",
      DROP COLUMN IF EXISTS "refunded_at"
    `);
  }
}
