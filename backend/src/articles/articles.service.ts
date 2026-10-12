import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Article } from './entities/article.entity';
import { Event } from '../events/entities/event.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import {
  ArticleResponseDto,
  ArticlesListResponseDto,
  toArticleResponseDto,
} from './dto/article-response.dto';

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
    search?: string
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

  async create(dto: CreateArticleDto, authorId: string): Promise<ArticleResponseDto> {
    const article = this.articlesRepository.create({
      title: dto.title,
      content: dto.content ?? null,
      category: dto.category ?? null,
      coverUrl: dto.cover_url ?? null,
      gallery: dto.gallery ?? [],
      relatedArticleIds: dto.related_article_ids ?? [],
      eventId: dto.event_id ?? null,
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
    if (dto.content !== undefined) article.content = dto.content;
    if (dto.category !== undefined) article.category = dto.category;
    if (dto.cover_url !== undefined) article.coverUrl = dto.cover_url;
    if (dto.gallery !== undefined) article.gallery = dto.gallery;
    if (dto.related_article_ids !== undefined) article.relatedArticleIds = dto.related_article_ids;
    if (dto.event_id !== undefined) article.eventId = dto.event_id;
    if (authorId !== undefined) article.authorId = authorId;

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
