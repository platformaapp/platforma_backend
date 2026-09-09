import { Article } from '../entities/article.entity';

export class ArticleAuthorDto {
  id: string;
  name: string;
  avatar_url: string | null;
  role_title: string | null;
}

export class ArticleResponseDto {
  id: string;
  title: string;
  content: string | null;
  category: string | null;
  cover_url: string | null;
  gallery: string[];
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

export function toArticleResponseDto(article: Article): ArticleResponseDto {
  return {
    id: article.id,
    title: article.title,
    content: article.content,
    category: article.category,
    cover_url: article.coverUrl,
    gallery: article.gallery ?? [],
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
