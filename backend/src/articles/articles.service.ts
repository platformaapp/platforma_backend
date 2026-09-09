import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from './entities/article.entity';
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
  ) {}

  async findAll(page = 1, per_page = 20, category?: string): Promise<ArticlesListResponseDto> {
    const qb = this.articlesRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .orderBy('article.createdAt', 'DESC');

    if (category) {
      qb.andWhere('article.category = :category', { category });
    }

    const total = await qb.getCount();
    const articles = await qb
      .skip((page - 1) * per_page)
      .take(per_page)
      .getMany();

    return {
      data: articles.map(toArticleResponseDto),
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
    return toArticleResponseDto(article);
  }

  async create(dto: CreateArticleDto, authorId: string): Promise<ArticleResponseDto> {
    const article = this.articlesRepository.create({
      title: dto.title,
      content: dto.content ?? null,
      category: dto.category ?? null,
      coverUrl: dto.cover_url ?? null,
      gallery: dto.gallery ?? [],
      authorId,
    });
    const saved = await this.articlesRepository.save(article);
    const full = await this.articlesRepository.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });
    return toArticleResponseDto(full!);
  }

  async update(id: string, dto: UpdateArticleDto): Promise<ArticleResponseDto> {
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

    const saved = await this.articlesRepository.save(article);
    const full = await this.articlesRepository.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });
    return toArticleResponseDto(full!);
  }

  async remove(id: string): Promise<void> {
    const result = await this.articlesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Article ${id} not found`);
    }
  }
}
