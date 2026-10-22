import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUrl,
  IsUUID,
  IsBoolean,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeTags } from '../../utils/tags';

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
}
