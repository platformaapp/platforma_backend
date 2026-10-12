import { Article } from '../entities/article.entity';
import { Event } from '../../events/entities/event.entity';

export class ArticleAuthorDto {
  id: string;
  name: string;
  avatar_url: string | null;
  role_title: string | null;
}

export class RelatedArticleSummaryDto {
  id: string;
  title: string;
  category: string | null;
  cover_url: string | null;
}

export class ArticleEventSummaryDto {
  id: string;
  title: string;
  cover_url: string | null;
  datetime_start: string | null;
  price: number;
}

export class ArticleResponseDto {
  id: string;
  title: string;
  content: string | null;
  category: string | null;
  cover_url: string | null;
  gallery: string[];
  /** Подпись под второй (правой) фотографией галереи. */
  gallery_caption: string | null;
  related_article_ids: string[];
  /** Развёрнутые связанные статьи (id/title/cover) — только там, где уже
   *  подгружены сервисом (findOne), в списках (findAll) остаётся undefined,
   *  чтобы не плодить лишние запросы к БД. */
  related_articles?: RelatedArticleSummaryDto[];
  event_id: string | null;
  /** Развёрнутое событие (та же логика, что у related_articles) —
   *  для CTA "Записаться на событие" на странице статьи. */
  event?: ArticleEventSummaryDto | null;
  author: ArticleAuthorDto;
  created_at: string;
  updated_at: string;
}

export class ArticlesListResponseDto {
  data: ArticleResponseDto[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
  };
}

export function toArticleResponseDto(
  article: Article,
  relatedArticles?: Article[],
  event?: Event | null
): ArticleResponseDto {
  return {
    id: article.id,
    title: article.title,
    content: article.content,
    category: article.category,
    cover_url: article.coverUrl,
    gallery: article.gallery ?? [],
    gallery_caption: article.galleryCaption ?? null,
    related_article_ids: article.relatedArticleIds ?? [],
    related_articles: relatedArticles?.map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category,
      cover_url: a.coverUrl,
    })),
    event_id: article.eventId ?? null,
    event: event
      ? {
          id: event.id,
          title: event.title,
          cover_url: event.coverUrl,
          datetime_start: event.datetimeStart ? event.datetimeStart.toISOString() : null,
          price: event.price,
        }
      : undefined,
    author: {
      id: article.author.id,
      name: article.author.fullName || article.author.email.split('@')[0],
      avatar_url: article.author.avatarUrl ?? null,
      role_title: article.author.specialization ?? null,
    },
    created_at: article.createdAt.toISOString(),
    updated_at: article.updatedAt.toISOString(),
  };
}
