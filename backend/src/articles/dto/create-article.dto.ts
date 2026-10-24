import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUrl,
  IsUUID,
  IsBoolean,
  IsDateString,
  Matches,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeTags } from '../../utils/tags';
import { SLUG_PATTERN } from '../../utils/slug';

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsUrl()
  cover_url?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  gallery?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gallery_caption?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsUUID('4', { each: true })
  related_article_ids?: string[];

  @IsOptional()
  @IsUUID()
  event_id?: string | null;

  @IsOptional()
  @IsBoolean()
  show_banner?: boolean;

  /** Хэштеги (без "#", см. utils/tags.ts) — рядом с именем автора на сайте. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => normalizeTags(value))
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  seo_title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  h1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meta_description?: string;

  /** Если не задан — генерируется из title (см. ArticlesService.create). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(SLUG_PATTERN, {
    message: 'slug может содержать только строчные латинские буквы, цифры и дефисы',
  })
  slug?: string;

  @IsOptional()
  @IsUrl()
  canonical_url?: string;

  @IsOptional()
  @IsBoolean()
  noindex?: boolean;

  @IsOptional()
  @IsBoolean()
  nofollow?: boolean;

  /** Если не задан — при создании подставляется текущее время. */
  @IsOptional()
  @IsDateString()
  published_at?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  og_title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  og_description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cover_alt?: string;

  /** gallery_alt[i] — подпись для gallery[i] (см. комментарий у Article.galleryAlt). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  gallery_alt?: string[];
}
