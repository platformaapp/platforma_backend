import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Article } from './entities/article.entity';
import { Event } from '../events/entities/event.entity';
import { User } from '../users/user.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import {
  ArticleResponseDto,
  ArticlesListResponseDto,
  toArticleResponseDto,
} from './dto/article-response.dto';
import { slugify } from '../utils/slug';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>
  ) {}

  async findAll(
    page = 1,
    per_page = 20,
    category?: string,
    search?: string,
    authorId?: string,
    onlyPublished = true
  ): Promise<ArticlesListResponseDto> {
    const qb = this.articlesRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .orderBy('article.createdAt', 'DESC');

    if (category) {
      qb.andWhere('article.category = :category', { category });
    }
    if (search) {
      qb.andWhere('article.title ILIKE :search', { search: `%${search}%` });
    }
    if (authorId) {
      qb.andWhere('article.authorId = :authorId', { authorId });
    }
    // Заявки наставников (status='pending_review', см. Article.status) не
    // должны светиться на публичном /journal, пока админ их не проверил —
    // AdminArticlesController вызывает findAll с onlyPublished=false, чтобы
    // видеть и их тоже.
    if (onlyPublished) {
      qb.andWhere("article.status = 'published'");
    }

    const total = await qb.getCount();
    const articles = await qb
      .skip((page - 1) * per_page)
      .take(per_page)
      .getMany();

    return {
      data: articles.map((article) => toArticleResponseDto(article)),
      pagination: { page, per_page, total },
    };
  }

  async findOne(id: string): Promise<ArticleResponseDto> {
    const article = await this.articlesRepository.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }
    const relatedArticles = await this.findRelatedArticles(article.relatedArticleIds);
    const event = await this.findEvent(article.eventId);
    return toArticleResponseDto(article, relatedArticles, event);
  }

  /** Публичный маршрут резолвит статью по slug, не по id (см. ArticlesController
   *  — "slug — единственный публичный URL" это осознанное решение, не
   *  временная мера: /journal/<uuid> нигде не поддерживается). */
  async findBySlug(slug: string): Promise<ArticleResponseDto> {
    const article = await this.articlesRepository.findOne({
      where: { slug },
      relations: ['author'],
    });
    // status !== 'published' — заявка наставника, ещё не прошедшая проверку
    // (см. Article.status): отвечаем 404, как для несуществующей статьи, а
    // не отдаём её публично до того, как админ закончит с ней работать.
    if (!article || article.status !== 'published') {
      throw new NotFoundException(`Article with slug "${slug}" not found`);
    }
    const relatedArticles = await this.findRelatedArticles(article.relatedArticleIds);
    const event = await this.findEvent(article.eventId);
    return toArticleResponseDto(article, relatedArticles, event);
  }

  /** base — исходный текст (title или slug, присланный админом явно).
   *  excludeId — исключить саму статью из проверки уникальности (update
   *  своего же текущего slug не должен считаться коллизией). При коллизии
   *  добавляет "-2", "-3" и т.д. — та же логика, что и в бэкфилле
   *  (миграция AddSeoExtraFieldsToArticles). */
  private async generateUniqueSlug(base: string, excludeId?: string): Promise<string> {
    const normalized = slugify(base) || 'article';
    let candidate = normalized;
    for (let suffix = 2; ; suffix++) {
      const qb = this.articlesRepository
        .createQueryBuilder('article')
        .where('article.slug = :slug', { slug: candidate });
      if (excludeId) qb.andWhere('article.id != :excludeId', { excludeId });
      const exists = await qb.getExists();
      if (!exists) return candidate;
      candidate = `${normalized}-${suffix}`;
    }
  }

  /** Подтягивает связанные статьи по id, в исходном порядке (In() порядок
   *  не гарантирует) — и тихо отбрасывает уже удалённые. */
  private async findRelatedArticles(ids: string[]): Promise<Article[]> {
    if (!ids || ids.length === 0) return [];
    const found = await this.articlesRepository.findBy({ id: In(ids) });
    return ids.map((id) => found.find((a) => a.id === id)).filter((a): a is Article => !!a);
  }

  /** Тихо возвращает null, если событие уже удалено — та же логика, что и
   *  для related-статей. */
  private async findEvent(eventId: string | null): Promise<Event | null> {
    if (!eventId) return null;
    return this.eventsRepository.findOne({ where: { id: eventId } });
  }

  async create(
    dto: CreateArticleDto,
    authorId: string,
    status = 'published'
  ): Promise<ArticleResponseDto> {
    // slug — из явно заданного (если есть) или из title, с гарантией
    // уникальности (см. generateUniqueSlug); published_at — явно заданная
    // дата или "сейчас" (большинство статей публикуются сразу при создании).
    const slug = await this.generateUniqueSlug(dto.slug || dto.title);
    const article = this.articlesRepository.create({
      title: dto.title,
      status,
      content: dto.content ?? null,
      category: dto.category ?? null,
      coverUrl: dto.cover_url ?? null,
      gallery: dto.gallery ?? [],
      galleryCaption: dto.gallery_caption ?? null,
      relatedArticleIds: dto.related_article_ids ?? [],
      eventId: dto.event_id ?? null,
      showBanner: dto.show_banner ?? true,
      tags: dto.tags ?? [],
      seoTitle: dto.seo_title ?? null,
      h1: dto.h1 ?? null,
      metaDescription: dto.meta_description ?? null,
      slug,
      canonicalUrl: dto.canonical_url ?? null,
      noindex: dto.noindex ?? false,
      nofollow: dto.nofollow ?? false,
      publishedAt: dto.published_at ? new Date(dto.published_at) : new Date(),
      excerpt: dto.excerpt ?? null,
      ogTitle: dto.og_title ?? null,
      ogDescription: dto.og_description ?? null,
      coverAlt: dto.cover_alt ?? null,
      galleryAlt: dto.gallery_alt ?? [],
      authorId,
    });
    const saved = await this.articlesRepository.save(article);
    const full = await this.articlesRepository.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });
    const relatedArticles = await this.findRelatedArticles(full.relatedArticleIds);
    const event = await this.findEvent(full.eventId);
    return toArticleResponseDto(full, relatedArticles, event);
  }

  async update(id: string, dto: UpdateArticleDto, authorId?: string): Promise<ArticleResponseDto> {
    const article = await this.articlesRepository.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }

    if (dto.title !== undefined) article.title = dto.title;
    if (dto.status !== undefined) article.status = dto.status;
    if (dto.content !== undefined) article.content = dto.content;
    if (dto.category !== undefined) article.category = dto.category;
    if (dto.cover_url !== undefined) article.coverUrl = dto.cover_url;
    if (dto.gallery !== undefined) article.gallery = dto.gallery;
    if (dto.gallery_caption !== undefined) article.galleryCaption = dto.gallery_caption;
    if (dto.related_article_ids !== undefined) article.relatedArticleIds = dto.related_article_ids;
    if (dto.event_id !== undefined) article.eventId = dto.event_id;
    if (dto.show_banner !== undefined) article.showBanner = dto.show_banner;
    if (dto.tags !== undefined) article.tags = dto.tags;
    if (dto.seo_title !== undefined) article.seoTitle = dto.seo_title;
    if (dto.h1 !== undefined) article.h1 = dto.h1;
    if (dto.meta_description !== undefined) article.metaDescription = dto.meta_description;
    // slug НЕ пересчитывается из title автоматически при редактировании —
    // только если админ сам явно прислал новое значение (иначе правка
    // заголовка молча ломала бы уже расшаренные ссылки на статью).
    if (dto.slug !== undefined) article.slug = await this.generateUniqueSlug(dto.slug, id);
    if (dto.canonical_url !== undefined) article.canonicalUrl = dto.canonical_url;
    if (dto.noindex !== undefined) article.noindex = dto.noindex;
    if (dto.nofollow !== undefined) article.nofollow = dto.nofollow;
    if (dto.published_at !== undefined) article.publishedAt = new Date(dto.published_at);
    if (dto.excerpt !== undefined) article.excerpt = dto.excerpt;
    if (dto.og_title !== undefined) article.ogTitle = dto.og_title;
    if (dto.og_description !== undefined) article.ogDescription = dto.og_description;
    if (dto.cover_alt !== undefined) article.coverAlt = dto.cover_alt;
    if (dto.gallery_alt !== undefined) article.galleryAlt = dto.gallery_alt;
    if (authorId !== undefined) {
      // article был загружен с relations: ['author'] — на нём уже висит
      // СТАРЫЙ author как объект. Если поменять только article.authorId
      // (голую FK-колонку), TypeORM при save() всё равно пересчитывает
      // author_id из загруженного article.author (который не трогали) и
      // перезаписывает им наш новый authorId — смена автора молча не
      // сохранялась. Обновляем оба согласованно: TypeORM поддерживает
      // установку relation по одному id без подгрузки всей сущности.
      article.authorId = authorId;
      article.author = { id: authorId } as User;
    }

    const saved = await this.articlesRepository.save(article);
    const full = await this.articlesRepository.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });
    const relatedArticles = await this.findRelatedArticles(full.relatedArticleIds);
    const event = await this.findEvent(full.eventId);
    return toArticleResponseDto(full, relatedArticles, event);
  }

  async remove(id: string): Promise<void> {
    const result = await this.articlesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Article ${id} not found`);
    }
  }
}
