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

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ name: 'author_id' })
  authorId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
