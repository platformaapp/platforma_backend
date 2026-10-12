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

  @Column({ type: 'uuid', array: true, name: 'related_article_ids', default: '{}' })
  relatedArticleIds: string[];

  /** Событие, привязанное к статье (CTA "Записаться на событие") — выбирается
   *  в админке, см. ArticlesService.findEventSummary. */
  @Column({ type: 'uuid', name: 'event_id', nullable: true })
  eventId: string | null;

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
