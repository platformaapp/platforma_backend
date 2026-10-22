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
