import { Article } from '../entities/article.entity';
import { Event } from '../../events/entities/event.entity';

export class ArticleAuthorDto {
  id: string;
  name: string;
  avatar_url: string | null;
  role_title: string | null;
  /** Короткое био автора — сигнал E-E-A-T (экспертность/авторитетность) для
   *  поисковика у "советовательного" контента; показывается на странице
   *  статьи рядом с именем автора. */
  short_bio: string | null;
}

export class RelatedArticleSummaryDto {
  id: string;
  title: string;
  category: string | null;
  cover_url: string | null;
  /** Для ссылки на связанную статью с текущей (/journal/<slug>). */
  slug: string;
}

export class ArticleEventSummaryDto {
  id: string;
  title: string;
  cover_url: string | null;
  datetime_start: string | null;
  price: number;
  /** Категория привязанного события (enum EventCategory) — для блока
   *  "Окей, что ещё" на странице статьи: ближайшие события той же
   *  категории, см. journal/[id].web.tsx. */
  category: string | null;
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
  /** Показывать ли баннер рядом со вторым подзаголовком — настраивается в
   *  админке, по умолчанию true. */
  show_banner: boolean;
  /** Хэштеги статьи (без "#") — показываются на странице статьи рядом с
   *  именем автора. */
  tags: string[];
  /** SEO-поля (см. комментарий у Article entity) — все опциональные,
   *  фронтенд применяет фолбэк на title/content, если не заданы. */
  seo_title: string | null;
  h1: string | null;
  meta_description: string | null;
  /** Человекочитаемый URL — единственный публичный путь к статье
   *  (/journal/<slug>), см. комментарий у Article.slug. */
  slug: string;
  canonical_url: string | null;
  noindex: boolean;
  nofollow: boolean;
  published_at: string;
  excerpt: string | null;
  og_title: string | null;
  og_description: string | null;
  cover_alt: string | null;
  /** gallery_alt[i] ↔ gallery[i], см. комментарий у Article.galleryAlt. */
  gallery_alt: string[];
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
      slug: a.slug,
    })),
    event_id: article.eventId ?? null,
    event: event
      ? {
          id: event.id,
          title: event.title,
          cover_url: event.coverUrl,
          datetime_start: event.datetimeStart ? event.datetimeStart.toISOString() : null,
          price: event.price,
          category: event.category,
        }
      : undefined,
    show_banner: article.showBanner,
    tags: article.tags ?? [],
    seo_title: article.seoTitle ?? null,
    h1: article.h1 ?? null,
    meta_description: article.metaDescription ?? null,
    slug: article.slug,
    canonical_url: article.canonicalUrl ?? null,
    noindex: article.noindex,
    nofollow: article.nofollow,
    published_at: article.publishedAt.toISOString(),
    excerpt: article.excerpt ?? null,
    og_title: article.ogTitle ?? null,
    og_description: article.ogDescription ?? null,
    cover_alt: article.coverAlt ?? null,
    gallery_alt: article.galleryAlt ?? [],
    author: {
      id: article.author.id,
      name: article.author.fullName || article.author.email.split('@')[0],
      avatar_url: article.author.avatarUrl ?? null,
      role_title: article.author.specialization ?? null,
      short_bio: article.author.shortBio ?? null,
    },
    created_at: article.createdAt.toISOString(),
    updated_at: article.updatedAt.toISOString(),
  };
}
