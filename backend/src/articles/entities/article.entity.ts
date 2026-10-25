import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'text', name: 'cover_url', nullable: true })
  coverUrl: string | null;

  @Column({ type: 'text', array: true, name: 'gallery', default: '{}' })
  gallery: string[];

  /** Подпись под второй (правой) фотографией галереи — gallery[1]. */
  @Column({ type: 'text', name: 'gallery_caption', nullable: true })
  galleryCaption: string | null;

  @Column({ type: 'uuid', array: true, name: 'related_article_ids', default: '{}' })
  relatedArticleIds: string[];

  /** Событие, привязанное к статье (CTA "Записаться на событие") — выбирается
   *  в админке, см. ArticlesService.findEventSummary. */
  @Column({ type: 'uuid', name: 'event_id', nullable: true })
  eventId: string | null;

  /** Показывать ли баннер рядом со вторым подзаголовком — опционально,
   *  включается/выключается в админке. По умолчанию true (старое поведение
   *  для уже существующих статей). */
  @Column({ type: 'boolean', name: 'show_banner', default: true })
  showBanner: boolean;

  /** Хэштеги статьи (без "#") — рубрикатор по темам, не путать с category
   *  (формат контента). Показываются на сайте рядом с именем автора. */
  @Column({ type: 'text', array: true, name: 'tags', default: '{}' })
  tags: string[];

  /** SEO-поля — задаются в админке отдельно от обычных title/content,
   *  ничего не меняют на сайте сами по себе, кроме следующего:
   *  seoTitle → <title>, metaDescription → <meta name="description">
   *  (оба — только если заданы, иначе фолбэк на title/content), h1 →
   *  видимый заголовок на странице статьи ВМЕСТО title (если задан). */
  @Column({ type: 'varchar', length: 255, name: 'seo_title', nullable: true })
  seoTitle: string | null;

  @Column({ type: 'varchar', length: 255, name: 'h1', nullable: true })
  h1: string | null;

  @Column({ type: 'varchar', length: 500, name: 'meta_description', nullable: true })
  metaDescription: string | null;

  /** Человекочитаемый URL (/journal/<slug>) — единственный публичный путь к
   *  статье (см. ArticlesService.findBySlug/generateUniqueSlug). Задаётся
   *  автоматически из title при создании, если не указан явно; при
   *  редактировании НЕ пересчитывается заново автоматически (чтобы не
   *  ломать уже расшаренные ссылки при смене title) — только если админ
   *  сам его поменял. */
  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  /** <link rel="canonical"> — для дублей/пересекающихся по теме статей:
   *  явно указывает поисковику, какая версия "главная". Пусто в
   *  подавляющем большинстве случаев — фронтенд тогда использует
   *  собственный URL статьи как canonical. */
  @Column({ type: 'text', name: 'canonical_url', nullable: true })
  canonicalUrl: string | null;

  /** noindex/nofollow — точечно закрыть статью от индексации (черновики,
   *  слабый/технический контент, дубли), не убирая её с самого сайта.
   *  Влияет на <meta name="robots"> на странице статьи и на sitemap.xml
   *  (noindex-статьи туда не попадают — см. generate-sitemap.js на
   *  фронтенде). */
  @Column({ type: 'boolean', default: false })
  noindex: boolean;

  @Column({ type: 'boolean', default: false })
  nofollow: boolean;

  /** Дата публикации — отдельно от created_at (черновик мог быть создан
   *  раньше, чем опубликован) и от updated_at (правки не меняют дату
   *  публикации). Используется в structured data (schema.org
   *  datePublished) и как сигнал свежести контента для поисковика. По
   *  умолчанию при создании — текущее время (см. ArticlesService.create). */
  @Column({ type: 'timestamptz', name: 'published_at' })
  publishedAt: Date;

  /** Краткое описание — ОТДЕЛЬНО от meta_description: meta_description —
   *  это сниппет в выдаче поиска, excerpt — текст под статьёй в карточках
   *  журнала/ленты (/journal, "Окей, что ещё" и т.п.); формулировки для
   *  этих двух мест не всегда совпадают. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  excerpt: string | null;

  /** og:title/og:description — превью при шаринге в соцсети/мессенджеры,
   *  опционально переопределяют seo_title/meta_description (если не
   *  заданы — фронтенд берёт их). Отдельные поля, т.к. формулировка для
   *  сниппета в поиске и для карточки при шаринге не всегда одна и та же. */
  @Column({ type: 'varchar', length: 70, name: 'og_title', nullable: true })
  ogTitle: string | null;

  @Column({ type: 'varchar', length: 300, name: 'og_description', nullable: true })
  ogDescription: string | null;

  /** Alt-текст обложки — картиночный поиск и доступность (не влияет на
   *  og:image, тот всегда берётся из cover_url). */
  @Column({ type: 'varchar', length: 255, name: 'cover_alt', nullable: true })
  coverAlt: string | null;

  /** Alt-текст для каждой картинки галереи, тем же порядком, что и gallery
   *  (gallery[i] ↔ gallery_alt[i]) — параллельный массив, та же схема, что
   *  уже используется для tags/related_article_ids, а не перевод gallery на
   *  jsonb (не хотим мигрировать уже существующие данные на новый тип
   *  колонки ради этого). */
  @Column({ type: 'text', array: true, name: 'gallery_alt', default: '{}' })
  galleryAlt: string[];

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ name: 'author_id' })
  authorId: string;

  /** 'published' — видна публично (/journal, /journal/<slug>); 'pending_review' —
   *  заявка наставника на статью (см. TutorController.createArticle), ждёт
   *  проверки и доработки админом в /admin/journal-detail — публично не
   *  показывается (ArticlesService.findAll/findBySlug фильтруют по этому
   *  полю), но видна и редактируема в админке как обычно. Админские статьи
   *  по умолчанию сразу 'published' — старое поведение, без изменений. */
  @Column({ type: 'varchar', length: 20, default: 'published' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
