import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMessagesTable1748500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages (receiver_id);`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS messages;`);
  }
}
