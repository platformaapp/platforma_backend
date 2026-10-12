import {
  IsString,
  IsOptional,
  IsArray,
  IsUrl,
  IsUUID,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

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
}
