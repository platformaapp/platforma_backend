import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSeoExtraFieldsToArticles1792200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles"
      ADD COLUMN IF NOT EXISTS "slug" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "canonical_url" TEXT,
      ADD COLUMN IF NOT EXISTS "noindex" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "nofollow" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "excerpt" VARCHAR(300),
      ADD COLUMN IF NOT EXISTS "og_title" VARCHAR(70),
      ADD COLUMN IF NOT EXISTS "og_description" VARCHAR(300),
      ADD COLUMN IF NOT EXISTS "cover_alt" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "gallery_alt" TEXT[] NOT NULL DEFAULT '{}'
    `);

    // published_at: для уже существующих статей считаем, что они уже
    // опубликованы с момента создания — иначе все старые статьи разом
    // станут "непонятно когда опубликованными" для structured data.
    await queryRunner.query(`
      UPDATE "articles" SET "published_at" = "created_at" WHERE "published_at" IS NULL
    `);

    // slug: бэкфилл для уже существующих статей — транслитерация title, та
    // же логика (и та же таблица соответствий), что и в utils/slug.ts
    // (SQL-версия, т.к. миграция не может импортировать TS-код приложения).
    // translate() покрывает однобуквенные замены (а→a, ъ/ь→'' и т.д.),
    // replace() — те, что разворачиваются в несколько букв (ж→zh, щ→sch и
    // т.п., translate() умеет только 1-в-1). Порядок важен: сначала
    // многобуквенные replace(), потом translate() над остатком. Коллизии
    // (одинаковый slug у двух статей, пустой title после транслитерации —
    // например, заголовок из одних эмодзи/пунктуации) разрешаем добавлением
    // короткого суффикса от id — тот же манёвр, что делает
    // ArticlesService.generateUniqueSlug в рантайме для новых статей.
    await queryRunner.query(`
      WITH base_slugs AS (
        SELECT
          id,
          COALESCE(
            NULLIF(
              regexp_replace(
                regexp_replace(
                  translate(
                    replace(replace(replace(replace(replace(replace(replace(
                      lower(trim(title)),
                    'ж', 'zh'), 'ц', 'ts'), 'ч', 'ch'), 'ш', 'sh'), 'щ', 'sch'), 'ю', 'yu'), 'я', 'ya'),
                    'абвгдеёзийклмнопрстуфхыэъь',
                    'abvgdeeziyklmnoprstufhye'
                  ),
                  '[^a-z0-9]+', '-', 'g'
                ),
                '(^-+|-+$)', '', 'g'
              ),
              ''
            ),
            'article'
          ) AS base_slug
        FROM "articles"
        WHERE "slug" IS NULL
      ),
      numbered AS (
        SELECT
          id,
          base_slug,
          row_number() OVER (PARTITION BY base_slug ORDER BY id) AS rn
        FROM base_slugs
      )
      UPDATE "articles" a
      SET "slug" = CASE WHEN n.rn = 1 THEN n.base_slug ELSE n.base_slug || '-' || substr(a.id::text, 1, 8) END
      FROM numbered n
      WHERE a.id = n.id
    `);

    await queryRunner.query(`
      ALTER TABLE "articles" ALTER COLUMN "slug" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "articles" ADD CONSTRAINT "UQ_articles_slug" UNIQUE ("slug")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles"
      DROP CONSTRAINT IF EXISTS "UQ_articles_slug",
      DROP COLUMN IF EXISTS "slug",
      DROP COLUMN IF EXISTS "canonical_url",
      DROP COLUMN IF EXISTS "noindex",
      DROP COLUMN IF EXISTS "nofollow",
      DROP COLUMN IF EXISTS "published_at",
      DROP COLUMN IF EXISTS "excerpt",
      DROP COLUMN IF EXISTS "og_title",
      DROP COLUMN IF EXISTS "og_description",
      DROP COLUMN IF EXISTS "cover_alt",
      DROP COLUMN IF EXISTS "gallery_alt"
    `);
  }
}
