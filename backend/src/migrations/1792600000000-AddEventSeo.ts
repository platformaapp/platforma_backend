import { MigrationInterface, QueryRunner } from 'typeorm';
import { eventSlugBase } from '../utils/event-slug';

export class AddEventSeo1792600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "slug" varchar,
      ADD COLUMN IF NOT EXISTS "slug_aliases" text[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "meta_title" varchar(255),
      ADD COLUMN IF NOT EXISTS "meta_description" text,
      ADD COLUMN IF NOT EXISTS "og_image" text,
      ADD COLUMN IF NOT EXISTS "og_title" varchar(255),
      ADD COLUMN IF NOT EXISTS "og_description" text,
      ADD COLUMN IF NOT EXISTS "canonical_url" text,
      ADD COLUMN IF NOT EXISTS "noindex" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "nofollow" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "published_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "excerpt" text,
      ADD COLUMN IF NOT EXISTS "cover_alt" text`);
    await queryRunner.query('UPDATE events SET published_at = created_at WHERE published_at IS NULL');
    const rows: {id: string; title: string; slug: string | null}[] = await queryRunner.query('SELECT id, title, slug FROM events ORDER BY created_at, id');
    const used = new Set(rows.map(row => row.slug).filter(Boolean));
    for (const row of rows) {
      if (row.slug) continue;
      const base = eventSlugBase(row.title);
      let slug = base, count = 1;
      while (used.has(slug)) slug = `${base}-${++count}`;
      used.add(slug);
      await queryRunner.query('UPDATE events SET slug = $1 WHERE id = $2', [slug, row.id]);
    }
    await queryRunner.query(`ALTER TABLE events ALTER COLUMN slug SET NOT NULL, ALTER COLUMN published_at SET NOT NULL, ALTER COLUMN published_at SET DEFAULT CURRENT_TIMESTAMP`);
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_events_slug" ON events (slug)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_events_slug_aliases" ON events USING gin (slug_aliases)');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_events_slug"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_events_slug_aliases"');
    await queryRunner.query('ALTER TABLE events DROP COLUMN IF EXISTS "slug"');
    await queryRunner.query('ALTER TABLE events DROP COLUMN IF EXISTS "meta_title"');
    await queryRunner.query('ALTER TABLE events DROP COLUMN IF EXISTS "meta_description"');
    await queryRunner.query('ALTER TABLE events DROP COLUMN IF EXISTS "og_image"');
    await queryRunner.query('ALTER TABLE events DROP COLUMN IF EXISTS "og_title"');
    await queryRunner.query('ALTER TABLE events DROP COLUMN IF EXISTS "og_description"');
    await queryRunner.query('ALTER TABLE events DROP COLUMN IF EXISTS "canonical_url"');
    await queryRunner.query('ALTER TABLE events DROP COLUMN IF EXISTS "noindex"');
    await queryRunner.query('ALTER TABLE events DROP COLUMN IF EXISTS "nofollow"');
    await queryRunner.query('ALTER TABLE events DROP COLUMN IF EXISTS "published_at"');
    await queryRunner.query('ALTER TABLE events DROP COLUMN IF EXISTS "excerpt"');
    await queryRunner.query('ALTER TABLE events DROP COLUMN IF EXISTS "cover_alt"');
    await queryRunner.query('ALTER TABLE events DROP COLUMN IF EXISTS "slug_aliases"');
  }
}
