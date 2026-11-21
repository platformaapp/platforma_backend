import { IsNotIn, IsDefined, ValidateIf, IsBoolean, IsISO8601, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';

export class UpdateEventSeoDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @IsNotIn(['feed', 'my'])
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  meta_title?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  meta_description?: string | null;

  @IsOptional()
  @IsString()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  og_image?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  og_title?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  og_description?: string | null;

  @IsOptional()
  @IsString()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  canonical_url?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsDefined()
  @IsBoolean()
  noindex?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsDefined()
  @IsBoolean()
  nofollow?: boolean;

  @IsOptional()
  @IsISO8601()
  published_at?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  excerpt?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  cover_alt?: string | null;

}
