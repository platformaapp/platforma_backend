import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddYookassaPaymentIdToUserEvents1745698800000 implements MigrationInterface {
  name = 'AddYookassaPaymentIdToUserEvents1745698800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_events" ADD COLUMN IF NOT EXISTS "yookassa_payment_id" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_events" DROP COLUMN IF EXISTS "yookassa_payment_id"`
    );
  }
}
